import {
  Prisma,
  ReturnStatus,
  RefundStatus,
  ReturnDisputeStatus,
  CostCoveredBy,
} from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { paginate, PageResult } from '../../helpers/pagination.helper';

// A return is "active" (still capable of resolving into a real refund/
// replacement/return) in every status except these terminal ones — drives
// ReturnRepository.findActiveReturnsForOrderItems's duplicate-request check.
const TERMINAL_RETURN_STATUSES: ReturnStatus[] = [
  ReturnStatus.REJECTED,
  ReturnStatus.CANCELLED,
  ReturnStatus.COMPLETED,
];

/**
 * Explicit payload type for findAll's rows — paginate()'s generic `T` can't
 * be inferred from a dynamically-built `include` object (a known TypeScript/
 * Prisma limitation with this kind of generic wrapper), so it's spelled out
 * here and passed as paginate()'s type argument instead.
 */
export type ReturnListItem = Prisma.ReturnGetPayload<{
  include: {
    order: { select: { id: true; orderNumber: true; totalAmount: true; currency: true } };
    customer: { select: { email: true; firstName: true; lastName: true } };
    refund: { select: { id: true; amount: true; status: true } };
    statusHistory: { select: { fromStatus: true; actorRole: true } };
  };
}>;

export default class ReturnRepository {
  // Fields the admin returns list can sort by — same whitelist reasoning as
  // OrderRepository.SORTABLE_FIELDS.
  private static readonly SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'status']);

  static async createReturn(tenantId: string, data: Omit<Prisma.ReturnCreateInput, 'tenant'>) {
    return prisma.return.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  /**
   * Customer-facing request creation — a single nested Prisma `create` (Return
   * + its ReturnItems + ReturnEvidence + the first ReturnStatusHistory row),
   * already atomic as one query without needing an explicit `$transaction`.
   */
  static async createReturnWithItems(
    tenantId: string,
    data: Omit<Prisma.ReturnCreateInput, 'tenant' | 'items' | 'evidence' | 'statusHistory'>,
    items: {
      orderItemId: string;
      quantity: number;
      unitPriceSnapshot: Prisma.Decimal | number;
      supplierCostSnapshot?: Prisma.Decimal | number;
    }[],
    evidence: { url: string; mimeType?: string }[],
  ) {
    return prisma.return.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
        items: {
          create: items.map((item) => ({
            tenantId,
            orderItem: { connect: { id: item.orderItemId } },
            quantity: item.quantity,
            unitPriceSnapshot: item.unitPriceSnapshot,
            ...(item.supplierCostSnapshot !== undefined
              ? { supplierCostSnapshot: item.supplierCostSnapshot }
              : {}),
          })),
        },
        evidence: evidence.length
          ? { create: evidence.map((e) => ({ url: e.url, mimeType: e.mimeType })) }
          : undefined,
        statusHistory: {
          create: [{ toStatus: ReturnStatus.PENDING, actorRole: 'CUSTOMER' }],
        },
      },
      include: { items: true, evidence: true },
    });
  }

  /**
   * ReturnItem rows for any still-active (non-terminal) return already
   * covering any of `orderItemIds` — drives "prevent duplicate active
   * requests for the same order item" in ReturnService.createReturnRequest.
   */
  static async findActiveReturnsForOrderItems(tenantId: string, orderItemIds: string[]) {
    if (orderItemIds.length === 0) return [];
    return prisma.returnItem.findMany({
      where: {
        tenantId,
        orderItemId: { in: orderItemIds },
        return: { status: { notIn: TERMINAL_RETURN_STATUSES } },
      },
      select: { orderItemId: true, returnId: true },
    });
  }

  /**
   * Lightweight list of a customer's own requests — backs GET /returns/my.
   * Deliberately thin (no evidence/items/disputes) since this only needs to
   * answer "do I have a request on this order, and what's its status" for
   * the Orders list; the customer never sees the full admin detail shape.
   */
  static async findByCustomerId(tenantId: string, customerId: string) {
    return prisma.return.findMany({
      where: { tenantId, customerId },
      select: { id: true, orderId: true, status: true, requestType: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Full detail for one request, but customer-safe — items + evidence only,
   * ownership-filtered directly in the `where` clause (not a separate check
   * after the fact). Deliberately excludes disputes/financials/physical-
   * shipment: that's internal CJ/cost bookkeeping, not something a customer
   * needs or should see. `notes` (included via the default scalar select)
   * is what actually carries the admin's message — e.g. the "what else do
   * you need?" text from requestMoreEvidence — so the customer-facing detail
   * view can show it without a separate status-history fetch.
   */
  static async findByIdForCustomer(tenantId: string, returnId: string, customerId: string) {
    return prisma.return.findFirst({
      where: { id: returnId, tenantId, customerId },
      include: {
        items: { include: { orderItem: true } },
        evidence: { orderBy: { createdAt: 'asc' } },
      },
    });
  }

  /**
   * Appends evidence to an existing request — the customer-side half of
   * "admin asks for more evidence" (see ReturnService.requestMoreEvidence).
   * Always tagged CUSTOMER; an admin's own evidence (if that's ever added)
   * would go through a different, admin-only call.
   */
  static async addEvidence(returnId: string, evidence: { url: string; mimeType?: string }[]) {
    return prisma.returnEvidence.createMany({
      data: evidence.map((e) => ({
        returnId,
        url: e.url,
        mimeType: e.mimeType,
      })),
    });
  }

  static async findByOrderId(tenantId: string, orderId: string) {
    return prisma.return.findMany({
      where: { tenantId, orderId },
      include: { refund: true },
    });
  }

  /**
   * Just enough of the order to drive the returns UI (prefill a refund
   * amount, know whether there's a customer to attach a new return to) —
   * lets the returns feature answer "does this order have any open
   * returns, and what's it worth" from its own endpoint, without the
   * frontend needing to cross into the orders feature for it.
   */
  static async getOrderSummary(tenantId: string, orderId: string) {
    return prisma.commerceOrder.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, customerId: true, totalAmount: true, currency: true },
    });
  }

  static async findById(tenantId: string, returnId: string) {
    return prisma.return.findFirst({
      where: { id: returnId, tenantId },
      include: { refund: true },
    });
  }

  /**
   * Full nested detail for the admin review screen (and, later, the
   * dispute-refresh/financials endpoints) — order + customer context, every
   * requested item (with the underlying CommerceOrderItem for its title/
   * image/sku), every evidence file, dispute attempt, the financial
   * breakdown, any physical-shipment record, and the full status audit
   * trail in chronological order.
   */
  static async findByIdWithDetail(tenantId: string, returnId: string) {
    return prisma.return.findFirst({
      where: { id: returnId, tenantId },
      include: {
        order: {
          select: { id: true, orderNumber: true, totalAmount: true, currency: true },
        },
        customer: {
          select: { id: true, email: true, firstName: true, lastName: true, userId: true },
        },
        items: {
          include: {
            // externalId is how fileCjDispute finds which real CJ order to
            // dispute against — narrowed select on supplierOrder since this
            // same shape ends up in an admin-facing response.
            orderItem: {
              include: {
                supplierOrder: {
                  select: { id: true, externalId: true, supplier: { select: { name: true } } },
                },
              },
            },
          },
        },
        evidence: { orderBy: { createdAt: 'asc' } },
        disputes: { orderBy: { createdAt: 'desc' } },
        financials: true,
        physicalShipment: true,
        statusHistory: { orderBy: { createdAt: 'asc' } },
        refund: true,
      },
    });
  }

  /**
   * Paginated list for the admin returns page, scoped to one tenant.
   * Search matches the return reason, the order's number, or the requesting
   * customer's name/email.
   */
  static async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: ReturnStatus,
  ): Promise<PageResult<ReturnListItem>> {
    const where: Prisma.ReturnWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { reason: { contains: search, mode: 'insensitive' } },
          { order: { is: { orderNumber: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { email: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const orderBy: Prisma.ReturnOrderByWithRelationInput =
      sortBy && this.SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { createdAt: 'desc' };

    // paginate()'s IncludeInput generic can't be inferred from this
    // dynamically-built include object, and the delegate's own overloaded
    // signature rejects an explicit 4th type argument that matches it
    // exactly — cast through unknown rather than fighting Prisma's types.
    return paginate(prisma.return, {
      where,
      orderBy,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      filters: status ? { status } : undefined,
      include: {
        order: { select: { id: true, orderNumber: true, totalAmount: true, currency: true } },
        customer: { select: { email: true, firstName: true, lastName: true } },
        refund: { select: { id: true, amount: true, status: true } },
        // Just the single most recent transition — enough for
        // ReturnService.listReturns to flag "customer just resubmitted
        // evidence" per row without the queue needing the full detail
        // fetch's entire audit trail.
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { fromStatus: true, actorRole: true },
        },
      },
    }) as unknown as Promise<PageResult<ReturnListItem>>;
  }

  /**
   * Every UNDER_REVIEW return, for the "Customer Responded" queue filter —
   * a pseudo-status derived from status history (see ReturnService.
   * listReturns), not a real ReturnStatus, so it can't go through findAll's
   * single-column `where: { status }` filter. UNDER_REVIEW returns are a
   * small, bounded subset of the table, so the service layer does the final
   * "did the latest transition actually come from the customer" filter and
   * pagination in memory rather than this needing a correlated-subquery.
   */
  static async findUnderReview(
    tenantId: string,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ): Promise<ReturnListItem[]> {
    const where: Prisma.ReturnWhereInput = {
      tenantId,
      status: ReturnStatus.UNDER_REVIEW,
      ...(search && {
        OR: [
          { reason: { contains: search, mode: 'insensitive' } },
          { order: { is: { orderNumber: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { email: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const orderBy: Prisma.ReturnOrderByWithRelationInput =
      sortBy && this.SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { createdAt: 'desc' };

    return prisma.return.findMany({
      where,
      orderBy,
      include: {
        order: { select: { id: true, orderNumber: true, totalAmount: true, currency: true } },
        customer: { select: { email: true, firstName: true, lastName: true } },
        refund: { select: { id: true, amount: true, status: true } },
        statusHistory: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: { fromStatus: true, actorRole: true },
        },
      },
    });
  }

  /**
   * `returnId` is optional — a Refund isn't always tied to a Return; e.g.
   * OrderService.rejectOrder issues one directly, with no return involved.
   * The column itself is already nullable (`Refund.returnId String?`).
   */
  static async createRefund(
    tenantId: string,
    orderId: string,
    returnId: string | undefined,
    amount: number,
    transactionId?: string,
    reason?: string,
  ) {
    return prisma.refund.create({
      data: {
        tenantId,
        orderId,
        amount,
        status: RefundStatus.PENDING,
        ...(returnId ? { returnId } : {}),
        ...(transactionId ? { transactionId } : {}),
        ...(reason ? { reason } : {}),
      },
    });
  }

  static async updateReturnStatus(
    tenantId: string,
    returnId: string,
    status: ReturnStatus,
    notes?: string,
  ) {
    return prisma.return.updateMany({
      where: { id: returnId, tenantId },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    });
  }

  /**
   * The one place a request's status actually changes past creation —
   * updates `Return.status` (and `notes`, when given) and inserts the
   * matching `ReturnStatusHistory` row as a single atomic unit, interactive-
   * transaction form matching order.service.ts's own checkout transaction
   * style. `fromStatus` is read inside the transaction so the audit trail is
   * never wrong under a race, even though the actual transition legality
   * check (assertValidReturnTransition) runs just before this is called.
   */
  static async transitionStatus(
    tenantId: string,
    returnId: string,
    toStatus: ReturnStatus,
    actor: { userId?: string; role: 'CUSTOMER' | 'ADMIN' | 'SYSTEM' },
    note?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const existing = await tx.return.findFirstOrThrow({
        where: { id: returnId, tenantId },
        select: { status: true },
      });

      const updated = await tx.return.update({
        where: { id: returnId },
        data: {
          status: toStatus,
          ...(note !== undefined ? { notes: note } : {}),
          statusHistory: {
            create: {
              fromStatus: existing.status,
              toStatus,
              actorUserId: actor.userId,
              actorRole: actor.role,
              note,
            },
          },
        },
      });

      return updated;
    });
  }

  /**
   * One row per CJ dispute filing attempt — see ReturnService.fileCjDispute.
   * Never updates an existing row; a re-file after FAILED_TO_SUBMIT or a
   * cancelled dispute creates a new one, preserving history for the audit
   * trail (see design decision #3 in the implementation plan).
   */
  static async createDispute(
    returnId: string,
    data: {
      cjOrderExternalId: string;
      cjDisputeId?: string;
      businessDisputeId: string;
      expectType: number;
      refundType?: number;
      disputeReasonId?: number;
      status: ReturnDisputeStatus;
      cjRawResponse?: Prisma.InputJsonValue;
      notes?: string;
      submittedAt?: Date;
    },
  ) {
    return prisma.returnDispute.create({
      data: { returnId, ...data },
    });
  }

  /** Patches a dispute row after a status-refresh pull or an admin-confirmed outcome. */
  static async updateDispute(
    disputeId: string,
    data: Partial<{
      status: ReturnDisputeStatus;
      cjRawStatus: string | null;
      cjRefundAmount: Prisma.Decimal | number | null;
      cjRawResponse: Prisma.InputJsonValue;
      replacementTrackingNumber: string | null;
      replacementCarrier: string | null;
      resolvedAt: Date;
    }>,
  ) {
    return prisma.returnDispute.update({ where: { id: disputeId }, data });
  }

  /** The most recent dispute filed for a return — "the active one" per this feature's own convention (see ReturnDispute's doc comment). */
  static async findLatestDispute(tenantId: string, returnId: string) {
    return prisma.returnDispute.findFirst({
      where: { returnId, return: { tenantId } },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Creates the financials row on first write, merges on every subsequent
   * one — callers (fileCjDispute's cost seeding, confirmCjOutcome,
   * processRefund, createReplacementOrder) each only know their own slice
   * of the breakdown, not the whole thing at once.
   */
  static async upsertFinancials(
    tenantId: string,
    returnId: string,
    data: Partial<{
      originalProductCost: Prisma.Decimal | number;
      customerRefundAmount: Prisma.Decimal | number;
      cjReimbursementAmount: Prisma.Decimal | number;
      replacementProductCost: Prisma.Decimal | number;
      replacementShippingCost: Prisma.Decimal | number;
      costCoveredBy: CostCoveredBy;
      outcomeNotes: string;
    }>,
  ) {
    return prisma.returnFinancials.upsert({
      where: { returnId },
      update: data,
      create: { tenantId, returnId, ...data },
    });
  }

  /**
   * Marks the most recently created still-PENDING Refund for an order as
   * COMPLETED, once Stripe's `charge.refunded` webhook confirms the money
   * actually moved (see PaymentService.handleWebhook). Matches by order
   * rather than the specific Stripe refund id on the assumption that an
   * order has at most one refund in flight at a time — reasonable for this
   * store's scale, but would need tightening if concurrent partial refunds
   * on the same order become a real scenario.
   */
  static async markMostRecentPendingRefundCompleted(orderId: string) {
    const pending = await prisma.refund.findFirst({
      where: { orderId, status: RefundStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) return null;

    return prisma.refund.update({
      where: { id: pending.id },
      data: { status: RefundStatus.COMPLETED },
    });
  }
}
