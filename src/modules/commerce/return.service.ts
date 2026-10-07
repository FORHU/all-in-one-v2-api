import ReturnRepository from './return.repository';
import OrderRepository from './order.repository';
import PaymentService from './payment.service';
import NotificationRepository from '../system/notification.repository';
import { CJDropshippingAdapter } from '../../suppliers/cj-dropshipping/cj.adapter';
import { assertValidReturnTransition } from './return-status.util';
import { requireTenantId } from '../../utils/async-context';
import { throwResponse } from '../../utils/throw-response';
import {
  OrderStatus,
  Prisma,
  ReturnStatus,
  ReturnRequestType,
  ReturnPreferredResolution,
  CostCoveredBy,
} from '@prisma/client';
import { rabbitmq } from '../../infrastructure/rabbitmq';
import { ROUTING_KEYS } from '../../events/routing-keys';
import logger from '../../utils/logger';

export default class ReturnService {
  /**
   * Customer-facing entry point — the first step of the refund/replacement/
   * return flow. Signed-in only (mirrors OrderService.checkoutDirect's own
   * "signed-in-only" reasoning): a multi-step, identity-bound workflow like
   * this isn't something a guest-by-session-id should be able to start.
   * Validates ownership, delivery status, item membership, and rejects a
   * duplicate active request for any of the same order items before creating
   * the Return + its ReturnItems + ReturnEvidence + the first
   * ReturnStatusHistory row in one atomic nested create.
   */
  static async createReturnRequest(input: {
    orderId: string;
    customerId: string;
    items: { orderItemId: string; quantity: number }[];
    requestType: ReturnRequestType;
    reason: string;
    description?: string;
    preferredResolution?: ReturnPreferredResolution;
    evidence?: { url: string; mimeType?: string }[];
  }) {
    const tenantId = requireTenantId();

    const order = await OrderRepository.findById(tenantId, input.orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }
    if (order.customerId !== input.customerId) {
      // Same "404, not 403" idiom as OrderService.getOrderDetails — don't
      // reveal that an order id exists to someone who doesn't own it.
      return throwResponse(404, 'Order not found');
    }
    if (order.status !== OrderStatus.FULFILLED) {
      return throwResponse(409, 'Only a delivered order can be refunded, replaced, or returned');
    }
    if (!input.items.length) {
      return throwResponse(400, 'Select at least one item to request');
    }

    const orderItemsById = new Map(order.items.map((item) => [item.id, item]));
    for (const requested of input.items) {
      const orderItem = orderItemsById.get(requested.orderItemId);
      if (!orderItem) {
        return throwResponse(400, `Item ${requested.orderItemId} is not part of this order`);
      }
      if (requested.quantity < 1 || requested.quantity > orderItem.quantity) {
        return throwResponse(
          400,
          `Requested quantity for "${orderItem.productTitle}" must be between 1 and ${orderItem.quantity}`,
        );
      }
    }

    const orderItemIds = input.items.map((item) => item.orderItemId);
    const activeReturns = await ReturnRepository.findActiveReturnsForOrderItems(
      tenantId,
      orderItemIds,
    );
    if (activeReturns.length > 0) {
      return throwResponse(
        409,
        'One or more of these items already has an active refund/return request',
      );
    }

    const created = await ReturnRepository.createReturnWithItems(
      tenantId,
      {
        order: { connect: { id: input.orderId } },
        customer: { connect: { id: input.customerId } },
        reason: input.reason,
        requestType: input.requestType,
        ...(input.description ? { description: input.description } : {}),
        ...(input.preferredResolution ? { preferredResolution: input.preferredResolution } : {}),
      },
      input.items.map((requested) => {
        const orderItem = orderItemsById.get(requested.orderItemId)!;
        return {
          orderItemId: requested.orderItemId,
          quantity: requested.quantity,
          unitPriceSnapshot: orderItem.unitPrice,
          supplierCostSnapshot: orderItem.supplierCost ?? undefined,
        };
      }),
      input.evidence ?? [],
    );

    // Best-effort, same reasoning as every other notification call in this
    // codebase — a notification hiccup shouldn't turn a successful request
    // submission into a failed one.
    if (order.customer?.userId) {
      try {
        await NotificationRepository.createNotification(tenantId, {
          user: { connect: { id: order.customer.userId } },
          type: 'RETURN_REQUEST_STATUS',
          channel: 'IN_APP',
          title: 'Request submitted',
          message: `We've received your ${input.requestType.toLowerCase()} request for order ${order.orderNumber}. We'll review it shortly.`,
          data: { returnId: created.id, orderId: order.id, orderNumber: order.orderNumber },
        });
      } catch (error) {
        logger.error(
          `[ReturnService] Failed to send submitted notification for return ${created.id}`,
          error,
        );
      }
    }

    return created;
  }

  /** Lightweight list of the signed-in customer's own requests — backs the status pill on AccountPage's OrderCard. */
  static async getMyReturnRequests(customerId: string) {
    const tenantId = requireTenantId();
    return ReturnRepository.findByCustomerId(tenantId, customerId);
  }

  /**
   * Full, customer-safe detail for one of the signed-in customer's own
   * requests — backs the "View Request Status" button on AccountPage.
   * Ownership is enforced in the query itself (findByIdForCustomer's
   * `where` includes customerId), not as a separate check after the fact.
   */
  static async getMyReturnRequestDetail(returnId: string, customerId: string) {
    const tenantId = requireTenantId();
    const detail = await ReturnRepository.findByIdForCustomer(tenantId, returnId, customerId);
    if (!detail) {
      return throwResponse(404, 'Return not found');
    }
    return detail;
  }

  /**
   * Customer resubmits evidence after an admin's "request more evidence" —
   * the other half of requestMoreEvidence, which this codebase didn't have
   * until now. Legal while PENDING/UNDER_REVIEW/EVIDENCE_REQUIRED; from
   * EVIDENCE_REQUIRED specifically, also moves the request back to
   * UNDER_REVIEW so it reappears in the admin's active queue instead of
   * silently sitting there with new evidence nobody's been told to look at.
   */
  static async addCustomerEvidence(
    returnId: string,
    customerId: string,
    evidence: { url: string; mimeType?: string }[],
  ) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findById(tenantId, returnId);
    if (!existing || existing.customerId !== customerId) {
      return throwResponse(404, 'Return not found');
    }
    const evidenceAcceptingStatuses: ReturnStatus[] = [
      ReturnStatus.PENDING,
      ReturnStatus.UNDER_REVIEW,
      ReturnStatus.EVIDENCE_REQUIRED,
    ];
    if (!evidenceAcceptingStatuses.includes(existing.status)) {
      return throwResponse(409, 'This request can no longer accept new evidence');
    }
    if (!evidence.length) {
      return throwResponse(400, 'Attach at least one photo or video');
    }

    await ReturnRepository.addEvidence(returnId, evidence);

    if (existing.status === ReturnStatus.EVIDENCE_REQUIRED) {
      return ReturnRepository.transitionStatus(
        tenantId,
        returnId,
        ReturnStatus.UNDER_REVIEW,
        { role: 'CUSTOMER' },
        'Customer uploaded additional evidence',
      );
    }

    return existing;
  }

  /**
   * Full admin review detail — order/customer context, every requested
   * item, evidence, any dispute history, financials, physical-shipment
   * record, and the full status audit trail. Gated by `orders:read` at the
   * route, same as every other admin returns endpoint.
   */
  static async getReturnDetail(returnId: string) {
    const tenantId = requireTenantId();
    const detail = await ReturnRepository.findByIdWithDetail(tenantId, returnId);
    if (!detail) {
      return throwResponse(404, 'Return not found');
    }
    return detail;
  }

  /**
   * Admin starts reviewing a PENDING request. A separate step from approve/
   * reject/request-evidence (rather than folding it into the first of those)
   * so the audit trail shows exactly when someone started looking at it, not
   * just when they finished.
   */
  static async transitionToUnderReview(returnId: string, actorUserId?: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findById(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    assertValidReturnTransition(existing.status, ReturnStatus.UNDER_REVIEW);

    return ReturnRepository.transitionStatus(tenantId, returnId, ReturnStatus.UNDER_REVIEW, {
      userId: actorUserId,
      role: 'ADMIN',
    });
  }

  /**
   * Admin asks the customer for more evidence instead of deciding outright —
   * moves EVIDENCE_REQUIRED, which ReturnService.addCustomerEvidence (not yet
   * built) will move back to UNDER_REVIEW once they resubmit.
   */
  static async requestMoreEvidence(returnId: string, note: string, actorUserId?: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findByIdWithDetail(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    assertValidReturnTransition(existing.status, ReturnStatus.EVIDENCE_REQUIRED);

    const updated = await ReturnRepository.transitionStatus(
      tenantId,
      returnId,
      ReturnStatus.EVIDENCE_REQUIRED,
      { userId: actorUserId, role: 'ADMIN' },
      note,
    );

    await this.notifyCustomer(tenantId, existing, {
      title: 'More evidence needed',
      message: `We need a bit more information on your request for order ${existing.order.orderNumber}: ${note}`,
    });

    return updated;
  }

  /** Admin accepts the claim — doesn't move any money yet, see return-resolution.service.ts for what comes after. */
  static async approveReturnRequest(returnId: string, note?: string, actorUserId?: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findByIdWithDetail(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    assertValidReturnTransition(existing.status, ReturnStatus.APPROVED);

    const updated = await ReturnRepository.transitionStatus(
      tenantId,
      returnId,
      ReturnStatus.APPROVED,
      { userId: actorUserId, role: 'ADMIN' },
      note,
    );

    await this.notifyCustomer(tenantId, existing, {
      title: 'Request approved',
      message: `Your ${existing.requestType.toLowerCase()} request for order ${existing.order.orderNumber} has been approved. We'll follow up shortly.`,
    });

    return updated;
  }

  /** Admin declines the claim — terminal, no money moves, no CJ dispute is ever filed for this request. */
  static async rejectReturnRequest(returnId: string, reason: string, actorUserId?: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findByIdWithDetail(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    assertValidReturnTransition(existing.status, ReturnStatus.REJECTED);

    const updated = await ReturnRepository.transitionStatus(
      tenantId,
      returnId,
      ReturnStatus.REJECTED,
      { userId: actorUserId, role: 'ADMIN' },
      reason,
    );

    await this.notifyCustomer(tenantId, existing, {
      title: 'Request declined',
      message: `Your ${existing.requestType.toLowerCase()} request for order ${existing.order.orderNumber} was declined: ${reason}`,
    });

    return updated;
  }

  /**
   * Best-effort in-app notification — same "a notification hiccup shouldn't
   * fail an otherwise-successful request" convention every other
   * notification call in this codebase follows. No-ops for a guest's
   * request (no linked AuthUser to notify).
   */
  private static async notifyCustomer(
    tenantId: string,
    returnWithCustomer: { id: string; customer: { userId: string } | null },
    content: { title: string; message: string },
  ) {
    if (!returnWithCustomer.customer?.userId) return;
    try {
      await NotificationRepository.createNotification(tenantId, {
        user: { connect: { id: returnWithCustomer.customer.userId } },
        type: 'RETURN_REQUEST_STATUS',
        channel: 'IN_APP',
        title: content.title,
        message: content.message,
        data: { returnId: returnWithCustomer.id },
      });
    } catch (error) {
      logger.error(
        `[ReturnService] Failed to send notification for return ${returnWithCustomer.id}`,
        error,
      );
    }
  }

  /**
   * Admin tries to recover AddictStyle's cost from CJ before ever refunding
   * the customer out of pocket — files a real CJ dispute for the specific
   * items on this request. Deliberately does NOT use the generic adapter
   * method `CJDropshippingAdapter.requestRefund` (SupplierAdapter's
   * supplier-agnostic interface): that helper disputes every CJ-eligible
   * line item on the *whole* order, which is wrong here — a request only
   * covers some of an order's items. Calls the dispute chain directly
   * instead, same calls `requestRefund` itself makes internally
   * (getDisputeProducts -> getDisputeConfirmInfo -> createDispute).
   *
   * Known, inherited limitation (same one requestRefund already has): CJ's
   * own `lineItemId` isn't tracked anywhere against our CommerceOrderItem
   * rows, so there's no way to ask CJ to dispute *only* this request's
   * items out of everything on that CJ order — every CJ-eligible item on
   * the underlying supplier order gets disputed together. Also picks the
   * FIRST dispute reason CJ returns, same as requestRefund, since there's
   * no mapping yet from our reason text to CJ's disputeReasonId catalog.
   *
   * Never simulates success: any adapter failure or empty eligible-list
   * records FAILED_TO_SUBMIT with the raw response and leaves Return.status
   * at APPROVED untouched — the admin falls back to a manual resolution
   * (skip straight to a refund, or File CJ Dispute again later).
   */
  static async fileCjDispute(returnId: string, actorUserId?: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findByIdWithDetail(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    assertValidReturnTransition(existing.status, ReturnStatus.CJ_DISPUTE_SUBMITTED);

    const supplierOrders = new Set(
      existing.items
        .map((item) => item.orderItem.supplierOrder)
        .filter((so): so is NonNullable<typeof so> => !!so?.externalId),
    );
    if (supplierOrders.size === 0) {
      return throwResponse(409, 'None of these items were ever placed with a supplier');
    }
    if (supplierOrders.size > 1) {
      return throwResponse(
        409,
        'This request spans more than one supplier order — file disputes separately',
      );
    }
    const supplierOrder = [...supplierOrders][0];
    const externalId = supplierOrder.externalId as string;

    const cjAdapter = new CJDropshippingAdapter();
    const eligible = await cjAdapter.getDisputeProducts(externalId);
    if (eligible.length === 0) {
      await ReturnRepository.createDispute(returnId, {
        cjOrderExternalId: externalId,
        businessDisputeId: `RETURN-${returnId}-${Date.now()}`,
        expectType: existing.requestType === 'REPLACEMENT' ? 2 : 1,
        status: 'FAILED_TO_SUBMIT',
        notes: 'CJ reported no dispute-eligible line items on this order.',
      });
      return { filed: false as const, reason: 'No dispute-eligible line items on this order' };
    }

    const productInfoList = eligible.map((p) => ({
      lineItemId: p.lineItemId,
      quantity: p.quantity,
      price: p.price,
    }));

    const confirmInfo = await cjAdapter.getDisputeConfirmInfo(externalId, productInfoList);
    const reasonId = confirmInfo?.disputeReasons?.[0]?.id;
    if (!reasonId) {
      await ReturnRepository.createDispute(returnId, {
        cjOrderExternalId: externalId,
        businessDisputeId: `RETURN-${returnId}-${Date.now()}`,
        expectType: existing.requestType === 'REPLACEMENT' ? 2 : 1,
        status: 'FAILED_TO_SUBMIT',
        cjRawResponse: (confirmInfo ?? {}) as Prisma.InputJsonValue,
        notes: 'CJ returned no valid dispute reasons for these items.',
      });
      return { filed: false as const, reason: 'CJ returned no valid dispute reasons' };
    }

    const expectType = existing.requestType === 'REPLACEMENT' ? 2 : 1;
    const businessDisputeId = `RETURN-${returnId}-${Date.now()}`;
    const messageText =
      `${existing.reason}${existing.description ? ` — ${existing.description}` : ''}`.slice(0, 500);
    const imageUrl = existing.evidence
      .filter((e) => !e.mimeType?.startsWith('video/'))
      .map((e) => e.url);
    const videoUrl = existing.evidence
      .filter((e) => e.mimeType?.startsWith('video/'))
      .map((e) => e.url);

    const created = await cjAdapter.createDispute({
      orderId: externalId,
      businessDisputeId,
      disputeReasonId: reasonId,
      expectType,
      refundType: 1, // balance refund (credited to our CJ account) — matches requestRefund's own default
      messageText,
      ...(imageUrl.length ? { imageUrl } : {}),
      ...(videoUrl.length ? { videoUrl } : {}),
      productInfoList,
    });

    if (!created) {
      await ReturnRepository.createDispute(returnId, {
        cjOrderExternalId: externalId,
        businessDisputeId,
        expectType,
        refundType: 1,
        disputeReasonId: reasonId,
        status: 'FAILED_TO_SUBMIT',
        cjRawResponse: (confirmInfo ?? {}) as Prisma.InputJsonValue,
        notes: 'CJ rejected the dispute creation call.',
      });
      return { filed: false as const, reason: 'CJ rejected the dispute creation call' };
    }

    // Same lookup requestRefund does right after a successful createDispute —
    // CJ's create call only returns a boolean, not the new dispute's own id.
    const list = await cjAdapter.getDisputeList({ orderId: externalId });
    const cjDispute = list.items[0];

    await ReturnRepository.createDispute(returnId, {
      cjOrderExternalId: externalId,
      cjDisputeId: cjDispute?.disputeId,
      businessDisputeId,
      expectType,
      refundType: 1,
      disputeReasonId: reasonId,
      status: 'SUBMITTED',
      cjRawResponse: (cjDispute ?? {}) as Prisma.InputJsonValue,
      submittedAt: new Date(),
    });

    const updated = await ReturnRepository.transitionStatus(
      tenantId,
      returnId,
      ReturnStatus.CJ_DISPUTE_SUBMITTED,
      { userId: actorUserId, role: 'ADMIN' },
    );

    await this.notifyCustomer(tenantId, existing, {
      title: 'Working with our supplier',
      message: `We've reached out to our supplier to resolve your request for order ${existing.order.orderNumber}.`,
    });

    return { filed: true as const, return: updated };
  }

  /**
   * On-demand pull of CJ's current ruling — mirrors OrderService.
   * getOrderTracking's own pattern exactly (pull, not polled; `stale: true`
   * when CJ's API can't be reached or the dispute isn't found there, same
   * meaning that field already has for order tracking). Deliberately does
   * NOT touch Return.status or ReturnDispute.status itself — CJ's live
   * dispute API is unverified against a real order, so an admin always
   * reads the raw response and calls confirmCjOutcome explicitly rather
   * than this method guessing what CJ's status string means.
   */
  static async refreshCjDispute(returnId: string) {
    const tenantId = requireTenantId();
    const dispute = await ReturnRepository.findLatestDispute(tenantId, returnId);
    if (!dispute) {
      return throwResponse(404, 'No dispute has been filed for this request yet');
    }
    if (!dispute.cjDisputeId) {
      return { hasCjDisputeId: false as const, stale: true as const };
    }

    const cjAdapter = new CJDropshippingAdapter();
    const detail = await cjAdapter.getDisputeDetail(dispute.cjDisputeId);
    if (!detail) {
      return {
        hasCjDisputeId: true as const,
        cjRawStatus: dispute.cjRawStatus,
        cjRefundAmount: dispute.cjRefundAmount,
        stale: true as const,
      };
    }

    await ReturnRepository.updateDispute(dispute.id, {
      cjRawStatus: detail.status,
      cjRefundAmount: detail.refundAmount,
      cjRawResponse: detail as unknown as Prisma.InputJsonValue,
    });

    return {
      hasCjDisputeId: true as const,
      cjRawStatus: detail.status,
      cjRefundAmount: detail.refundAmount ?? null,
      stale: false as const,
    };
  }

  /**
   * The explicit admin decision CJ's unverified-live-API risk requires —
   * see refreshCjDispute's doc comment. Approving a REPLACEMENT-type
   * dispute (expectType 2, CJ funding the resend itself) moves straight to
   * REPLACEMENT_PROCESSING with zero replacement cost recorded — no
   * CommerceOrder is ever created for this branch, which is itself the
   * entire "don't auto-charge AddictStyle for a CJ-funded resend"
   * mechanism (see return-resolution.service.ts for the other branch, where
   * AddictStyle funds it and a real order/payment to CJ does happen).
   */
  static async confirmCjOutcome(
    returnId: string,
    outcome: 'APPROVED' | 'REJECTED',
    note?: string,
    actorUserId?: string,
  ) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findByIdWithDetail(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    const dispute = await ReturnRepository.findLatestDispute(tenantId, returnId);
    if (!dispute) {
      return throwResponse(409, 'No dispute has been filed for this request yet');
    }

    await ReturnRepository.updateDispute(dispute.id, {
      status: outcome,
      resolvedAt: new Date(),
    });

    if (outcome === 'REJECTED') {
      assertValidReturnTransition(existing.status, ReturnStatus.CJ_REJECTED);
      const updated = await ReturnRepository.transitionStatus(
        tenantId,
        returnId,
        ReturnStatus.CJ_REJECTED,
        { userId: actorUserId, role: 'ADMIN' },
        note,
      );
      await this.notifyCustomer(tenantId, existing, {
        title: 'Update on your request',
        message: `Our supplier didn't approve the claim for order ${existing.order.orderNumber}, but we're still reviewing your options.`,
      });
      return updated;
    }

    // outcome === 'APPROVED'
    if (dispute.expectType === 2) {
      assertValidReturnTransition(existing.status, ReturnStatus.REPLACEMENT_PROCESSING);
      const updated = await ReturnRepository.transitionStatus(
        tenantId,
        returnId,
        ReturnStatus.REPLACEMENT_PROCESSING,
        { userId: actorUserId, role: 'ADMIN' },
        note,
      );
      await ReturnRepository.upsertFinancials(tenantId, returnId, {
        costCoveredBy: 'CJ',
        replacementProductCost: 0,
        replacementShippingCost: 0,
      });
      await this.notifyCustomer(tenantId, existing, {
        title: 'Replacement on the way',
        message: `Our supplier approved a replacement for order ${existing.order.orderNumber}.`,
      });
      return updated;
    }

    assertValidReturnTransition(existing.status, ReturnStatus.CJ_APPROVED);
    const updated = await ReturnRepository.transitionStatus(
      tenantId,
      returnId,
      ReturnStatus.CJ_APPROVED,
      { userId: actorUserId, role: 'ADMIN' },
      note,
    );
    if (dispute.cjRefundAmount != null) {
      await ReturnRepository.upsertFinancials(tenantId, returnId, {
        cjReimbursementAmount: dispute.cjRefundAmount,
      });
    }
    await this.notifyCustomer(tenantId, existing, {
      title: 'Update on your request',
      message: `Our supplier approved the claim for order ${existing.order.orderNumber}. We'll process your resolution shortly.`,
    });
    return updated;
  }

  /**
   * The actual refund — real money moves here. Callable from APPROVED (the
   * "skip CJ entirely" path), CJ_APPROVED, CJ_REJECTED (AddictStyle eats the
   * cost), or RETURN_PROCESSING. Reuses the exact same Stripe call the
   * older, PENDING/APPROVED-only issueRefund already makes
   * (PaymentService.refundPayment) — nothing new on the payment side, just
   * a wider set of legal source statuses and real cost-attribution
   * bookkeeping that issueRefund has no concept of.
   *
   * `costCoveredBy` defaults from whether this request's financials already
   * show a CJ reimbursement (set by confirmCjOutcome when a refund-type
   * dispute was approved): CJ if so, ADDICTSTYLE otherwise (CJ rejected the
   * claim, or it was never disputed at all). Pass an explicit override for
   * an edge case this inference can't capture (e.g. SPLIT).
   *
   * Does not wait for Stripe's webhook before returning — same documented
   * tradeoff the old issueRefund already had, just now actually resolved:
   * PaymentService.handleWebhook's `charge.refunded` case advances this
   * same Return from REFUND_PROCESSING to COMPLETED once the money is
   * confirmed to have actually moved, instead of claiming COMPLETED here
   * synchronously.
   */
  static async processRefund(
    returnId: string,
    amount: number,
    note?: string,
    costCoveredByOverride?: CostCoveredBy,
    actorUserId?: string,
  ) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findByIdWithDetail(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    assertValidReturnTransition(existing.status, ReturnStatus.REFUND_PROCESSING);

    const { transactionId } = await PaymentService.refundPayment(existing.orderId, amount);
    await ReturnRepository.createRefund(
      tenantId,
      existing.orderId,
      returnId,
      amount,
      transactionId,
      note,
    );

    const costCoveredBy: CostCoveredBy =
      costCoveredByOverride ??
      (existing.financials?.cjReimbursementAmount != null ? 'CJ' : 'ADDICTSTYLE');
    await ReturnRepository.upsertFinancials(tenantId, returnId, {
      customerRefundAmount: amount,
      costCoveredBy,
    });

    const updated = await ReturnRepository.transitionStatus(
      tenantId,
      returnId,
      ReturnStatus.REFUND_PROCESSING,
      { userId: actorUserId, role: 'ADMIN' },
      note,
    );

    await this.notifyCustomer(tenantId, existing, {
      title: 'Refund on the way',
      message: `We've processed a refund for order ${existing.order.orderNumber}. You'll see it in your account soon.`,
    });

    return updated;
  }

  static async createReturn(input: {
    orderId: string;
    customerId: string;
    reason: string;
    notes?: string;
  }) {
    const tenantId = requireTenantId();
    return ReturnRepository.createReturn(tenantId, {
      order: { connect: { id: input.orderId } },
      customer: { connect: { id: input.customerId } },
      reason: input.reason,
      ...(input.notes ? { notes: input.notes } : {}),
    });
  }

  static async getReturnsByOrderId(orderId: string) {
    const tenantId = requireTenantId();
    const [order, returns] = await Promise.all([
      ReturnRepository.getOrderSummary(tenantId, orderId),
      ReturnRepository.findByOrderId(tenantId, orderId),
    ]);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }
    return { order, returns };
  }

  /** Paginated admin return list, scoped to the current tenant. */
  /**
   * Paginated admin queue. Each row additionally gets `hasNewCustomerEvidence`
   * — derived from the single most recent status-history entry
   * (EVIDENCE_REQUIRED -> UNDER_REVIEW, actor CUSTOMER — see
   * ReturnService.addCustomerEvidence), the same signal
   * ReturnDetailView.tsx's own banner is derived from — so the queue can
   * flag "customer just responded" without opening each request to check.
   * The raw statusHistory row is stripped before returning; the queue only
   * needs the derived boolean, not the full entry.
   */
  static async listReturns(
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: ReturnStatus,
    customerResponded?: boolean,
  ) {
    const tenantId = requireTenantId();

    // "Customer Responded" is a derived pseudo-status, not a real
    // ReturnStatus — findAll can't filter on it via `where: { status }`, so
    // it's handled as its own query + in-memory filter/paginate instead.
    if (customerResponded) {
      const pageVal = page ?? 1;
      const limitVal = limit ?? 20;
      const underReview = await ReturnRepository.findUnderReview(
        tenantId,
        search,
        sortBy,
        sortOrder,
      );
      const responded = underReview.filter(
        (item) =>
          item.statusHistory?.[0]?.fromStatus === ReturnStatus.EVIDENCE_REQUIRED &&
          item.statusHistory?.[0]?.actorRole === 'CUSTOMER',
      );
      const start = (pageVal - 1) * limitVal;
      const pageItems = responded.slice(start, start + limitVal);

      return {
        items: pageItems.map((item) => {
          const { statusHistory: _statusHistory, ...rest } = item;
          return { ...rest, hasNewCustomerEvidence: true };
        }),
        total: responded.length,
        page: pageVal,
        limit: limitVal,
        totalPages: limitVal > 0 ? Math.ceil(responded.length / limitVal) : 0,
      };
    }

    const result = await ReturnRepository.findAll(
      tenantId,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status,
    );

    return {
      ...result,
      items: result.items.map((item) => {
        const latest = item.statusHistory?.[0];
        const { statusHistory: _statusHistory, ...rest } = item;
        return {
          ...rest,
          hasNewCustomerEvidence:
            item.status === ReturnStatus.UNDER_REVIEW &&
            latest?.fromStatus === ReturnStatus.EVIDENCE_REQUIRED &&
            latest?.actorRole === 'CUSTOMER',
        };
      }),
    };
  }

  static async approveReturn(returnId: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findById(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    if (existing.status !== ReturnStatus.PENDING) {
      return throwResponse(409, `Return is already ${existing.status.toLowerCase()}`);
    }
    await ReturnRepository.updateReturnStatus(tenantId, returnId, ReturnStatus.APPROVED);
    return ReturnRepository.findById(tenantId, returnId);
  }

  static async rejectReturn(returnId: string, notes?: string) {
    const tenantId = requireTenantId();
    const existing = await ReturnRepository.findById(tenantId, returnId);
    if (!existing) {
      return throwResponse(404, 'Return not found');
    }
    if (existing.status !== ReturnStatus.PENDING) {
      return throwResponse(409, `Return is already ${existing.status.toLowerCase()}`);
    }
    await ReturnRepository.updateReturnStatus(tenantId, returnId, ReturnStatus.REJECTED, notes);
    return ReturnRepository.findById(tenantId, returnId);
  }

  /**
   * Issues a real Stripe refund (PaymentService.refundPayment) and records
   * it as a Refund row. The Refund/Payment don't get marked COMPLETED/
   * REFUNDED here — that only happens once Stripe's `charge.refunded`
   * webhook confirms the money actually moved (see
   * PaymentService.handleWebhook and ReturnRepository.markMostRecentPendingRefundCompleted).
   * Return.status advancing to COMPLETED right below is the one place that
   * doesn't wait for that confirmation — a known, pre-existing gap, not
   * introduced here.
   */
  static async issueRefund(orderId: string, returnId: string, amount: number, reason?: string) {
    const tenantId = requireTenantId();

    const existingReturn = await ReturnRepository.findById(tenantId, returnId);
    if (!existingReturn || existingReturn.orderId !== orderId) {
      return throwResponse(404, 'Return not found');
    }
    if (existingReturn.status !== ReturnStatus.APPROVED) {
      return throwResponse(409, 'Return must be approved before a refund can be issued');
    }

    const { transactionId } = await PaymentService.refundPayment(orderId, amount);
    const refund = await ReturnRepository.createRefund(
      tenantId,
      orderId,
      returnId,
      amount,
      transactionId,
      reason,
    );
    await ReturnRepository.updateReturnStatus(tenantId, returnId, ReturnStatus.COMPLETED);

    // A refund covering the full order total closes the order out; a
    // partial refund leaves fulfillment status alone (the schema has no
    // partially-refunded order state).
    const order = await OrderRepository.findById(tenantId, orderId);
    if (order && new Prisma.Decimal(amount).equals(order.totalAmount)) {
      await OrderRepository.updateStatus(tenantId, orderId, OrderStatus.REFUNDED);
    }

    // The Stripe side of the refund is done and already committed above —
    // this is the customer's money moving, and it must not be rolled back
    // or fail the request just because notifying the supplier had trouble.
    // The actual supplier-side refund (e.g. filing a CJ dispute) happens
    // asynchronously in supplier-refund.consumer.ts, per this codebase's
    // "if it takes time, it goes to RabbitMQ" rule — CJ's dispute chain is
    // several sequential HTTP calls and CJ's own (unbounded) review time,
    // nothing an HTTP request should block on.
    try {
      const supplierOrders = await OrderRepository.getSupplierOrders(tenantId, orderId);
      for (const supplierOrder of supplierOrders) {
        // Never placed with the supplier (no externalId) — nothing to
        // refund on their end, whether because checkout never got that far
        // wired up yet or the order was cancelled before placement.
        if (!supplierOrder.externalId) continue;

        await rabbitmq.publish(ROUTING_KEYS.SUPPLIER_ORDER_REFUND_REQUESTED, {
          tenantId,
          supplierOrderId: supplierOrder.id,
          supplierId: supplierOrder.supplier.name,
          externalId: supplierOrder.externalId,
          reason: reason || 'Customer-requested refund',
        });
      }
    } catch (error) {
      logger.error(
        `[ReturnService] Failed to publish supplier refund request(s) for order ${orderId}`,
        error,
      );
    }

    return refund;
  }
}
