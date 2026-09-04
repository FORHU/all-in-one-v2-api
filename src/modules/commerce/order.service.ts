import OrderRepository from './order.repository';
import CartRepository from './cart.repository';
import CustomerRepository from './customer.repository';
import CouponRepository from './coupon.repository';
import CouponService from './coupon.service';
import PromotionRepository from '../promotion/promotion.repository';
import PromotionEngine, { PromotionLineItem } from '../promotion/promotion.engine';
import InventoryRepository from '../inventory/inventory.repository';
import NotificationRepository from '../system/notification.repository';
import { OrderStatus, PaymentStatus, Prisma, Coupon } from '@prisma/client';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';
import { prisma } from '../../utils/prisma';
import logger from '../../utils/logger';

/**
 * Who is asking to see an order: a signed-in customer, a guest holding the
 * session that placed it, or a platform admin.
 */
export interface OrderViewer {
  customerId?: string;
  sessionId?: string;
  isAdmin: boolean;
}

interface CartItemLike {
  productVariantId: string;
  quantity: number;
  unitPrice: unknown;
  productVariant?: {
    sku: string | null;
    title: string | null;
    product: {
      title: string;
    };
    media?: { url: string }[];
  };
}

export default class OrderService {
  /**
   * An order belongs to the signed-in customer who placed it, or — for guest
   * checkout, where customerId is null — to whoever holds the session id it
   * was placed with.
   */
  static isOrderOwner(
    order: { customerId?: string | null; sessionId?: string | null },
    viewer: OrderViewer,
  ): boolean {
    if (viewer.customerId && order.customerId === viewer.customerId) return true;
    if (viewer.sessionId && order.sessionId && order.sessionId === viewer.sessionId) return true;
    return false;
  }

  static async getOrderDetails(orderId: string, viewer: OrderViewer) {
    const order = await OrderRepository.findById(requireTenantId(), orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    // Orders carry names, addresses and totals. Anyone who isn't the owner gets
    // the same 404 as a non-existent order, so ids can't be probed.
    if (!viewer.isAdmin && !this.isOrderOwner(order, viewer)) {
      return throwResponse(404, 'Order not found');
    }

    return order;
  }

  /** Orders for this customer *in the current vertical* only. */
  static async getCustomerOrders(customerId: string, page: number = 1, limit: number = 10) {
    return OrderRepository.findByCustomerId(requireTenantId(), customerId, page, limit);
  }

  /** Paginated admin order list, scoped to the current tenant. */
  static async listOrders(
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: OrderStatus,
  ) {
    return OrderRepository.findAll(
      requireTenantId(),
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status,
    );
  }

  static async checkoutFromCart(params: {
    customerId?: string;
    sessionId?: string;
    shippingAddressId?: string;
    couponCode?: string;
    promotionCode?: string;
    currency?: string;
  }) {
    const {
      customerId,
      sessionId,
      shippingAddressId,
      couponCode,
      promotionCode,
      currency = 'USD',
    } = params;

    if (!customerId && !sessionId) {
      return throwResponse(400, 'A signed-in customer or an x-session-id header is required');
    }

    const tenantId = requireTenantId();

    // Resolve the cart from the caller's own identity, within this vertical.
    // Taking a cartId from the request body would let anyone check out — and
    // then clear — another shopper's cart.
    const cart = customerId
      ? await CartRepository.findByCustomerId(tenantId, customerId)
      : await CartRepository.findBySessionId(tenantId, sessionId as string);

    if (!cart || cart.items.length === 0) {
      return throwResponse(400, 'Cart is empty');
    }

    return this.createOrderFromItems(cart.items, {
      tenantId,
      customerId,
      sessionId,
      shippingAddressId,
      couponCode,
      promotionCode,
      currency,
      afterCreate: async (tx) => {
        // Clear the cart we actually read from inside the transaction.
        // Stock has been reserved above (Optimistic locking is available in InventoryRepository).
        await tx.commerceCartItem.deleteMany({ where: { cartId: cart.id } });
      },
    });
  }

  /**
   * Checkout without a persisted backend cart — resolves each requested
   * product+size+color straight to a CatalogProductVariant and creates the
   * order directly. Exists because the storefront's cart is currently
   * client-only (localStorage), so there's nothing in CommerceCart for
   * checkoutFromCart to read; this lets checkout still produce a real
   * CommerceOrder without first migrating the whole cart UI to the real
   * /v2/cart endpoints. Signed-in customers only — unlike checkoutFromCart,
   * there's no guest/session concept here.
   */
  static async checkoutDirect(params: {
    customerId: string;
    userId: string;
    items: { productId: string; size?: string; color?: string; quantity: number }[];
    shippingAddressId?: string;
    couponCode?: string;
    promotionCode?: string;
    currency?: string;
  }) {
    const {
      customerId,
      userId,
      items,
      shippingAddressId,
      couponCode,
      promotionCode,
      currency = 'USD',
    } = params;

    if (!items || items.length === 0) {
      return throwResponse(400, 'No items provided');
    }

    const tenantId = requireTenantId();
    const resolvedItems = await this.resolveDirectCheckoutItems(tenantId, items);

    const order = await this.createOrderFromItems(resolvedItems, {
      tenantId,
      customerId,
      shippingAddressId,
      couponCode,
      promotionCode,
      currency,
    });

    // Best-effort: the order is already committed at this point, so a
    // notification hiccup shouldn't turn a successful checkout into a
    // failed request.
    try {
      await NotificationRepository.createNotification(tenantId, {
        user: { connect: { id: userId } },
        type: 'ORDER_STATUS',
        channel: 'IN_APP',
        title: 'Order Placed',
        message: `Your order ${order.orderNumber} has been placed.`,
        data: { orderId: order.id, orderNumber: order.orderNumber },
      });
    } catch (err) {
      logger.warn(`Failed to create order-placed notification for order ${order.id}: ${err}`);
    }

    return order;
  }

  /**
   * Matches each {productId, size, color} to a real CatalogProductVariant —
   * same loose "some variant has this color value AND some/the-same variant
   * has this size value" matching the storefront listing already applies at
   * the product level (see catalog/product.repository.ts's buildWhere), just
   * narrowed down to one specific variant here.
   */
  private static async resolveDirectCheckoutItems(
    tenantId: string,
    items: { productId: string; size?: string; color?: string; quantity: number }[],
  ): Promise<CartItemLike[]> {
    const resolved: CartItemLike[] = [];

    for (const item of items) {
      const variant = await prisma.catalogProductVariant.findFirst({
        where: {
          tenantId,
          productId: item.productId,
          deletedAt: null,
          ...(item.color
            ? {
                variantAttributes: {
                  some: { value: { value: item.color, attribute: { code: 'color' } } },
                },
              }
            : {}),
          ...(item.size
            ? {
                variantAttributes: {
                  some: { value: { value: item.size, attribute: { code: 'size' } } },
                },
              }
            : {}),
        },
        include: {
          product: { select: { title: true, thumbnailUrl: true } },
          media: { where: { isPrimary: true }, take: 1 },
        },
      });

      if (!variant) {
        return throwResponse(
          404,
          `No matching product variant found for product ${item.productId}` +
            (item.color || item.size
              ? ` (${[item.color, item.size].filter(Boolean).join(', ')})`
              : ''),
        );
      }

      // Seed/import data attaches the primary image to the product, not each
      // variant (CatalogProductMedia.productVariantId is null for it) — fall
      // back to the product's thumbnailUrl when the variant has no image of
      // its own, or every order item ends up with no picture.
      const imageUrl = variant.media[0]?.url ?? variant.product.thumbnailUrl ?? null;

      resolved.push({
        productVariantId: variant.id,
        quantity: item.quantity,
        unitPrice: variant.price,
        productVariant: {
          sku: variant.sku,
          title: variant.title,
          product: { title: variant.product.title },
          media: imageUrl ? [{ url: imageUrl }] : [],
        },
      });
    }

    return resolved;
  }

  /**
   * Shared by checkoutFromCart and checkoutDirect: subtotal/coupon/discount
   * math, stock reservation, and the CommerceOrder-creation transaction.
   * `afterCreate` runs inside the same transaction as order creation (used
   * by checkoutFromCart to clear the cart it read from — checkoutDirect has
   * no cart to clear, so it's optional).
   */
  private static async createOrderFromItems(
    items: CartItemLike[],
    params: {
      tenantId: string;
      customerId?: string;
      sessionId?: string;
      shippingAddressId?: string;
      couponCode?: string;
      promotionCode?: string;
      currency?: string;
      afterCreate?: (tx: Prisma.TransactionClient) => Promise<void>;
    },
  ) {
    const {
      tenantId,
      customerId,
      sessionId,
      shippingAddressId,
      couponCode,
      promotionCode,
      currency = 'USD',
    } = params;

    if (shippingAddressId) {
      const address = await CustomerRepository.findAddressById(shippingAddressId);
      if (!address || (customerId && address.customerId !== customerId)) {
        return throwResponse(404, 'Shipping address not found');
      }
    }

    // Decimal, not float: `0.1 + 0.2` is not `0.3`, and a cart of enough cheap
    // line items drifts far enough to disagree with what the gateway charges.
    const subtotal = items.reduce(
      (acc: Prisma.Decimal, item: CartItemLike) =>
        acc.plus(new Prisma.Decimal(item.unitPrice as Prisma.Decimal.Value).times(item.quantity)),
      new Prisma.Decimal(0),
    );

    let coupon: Coupon | null = null;
    if (couponCode) {
      coupon = await CouponRepository.findByCode(tenantId, couponCode);
      if (!coupon) return throwResponse(400, 'Invalid or expired coupon');
      // Active, unexpired, under its usage cap, and over its minimum order value.
      CouponService.assertUsable(coupon, subtotal);
    }

    let couponDiscount = new Prisma.Decimal(0);
    if (coupon) {
      if (coupon.discountType === 'PERCENTAGE') {
        couponDiscount = subtotal
          .times(new Prisma.Decimal(coupon.discountValue as Prisma.Decimal.Value))
          .dividedBy(100);
        if (
          coupon.maxDiscount &&
          couponDiscount.greaterThan(new Prisma.Decimal(coupon.maxDiscount as Prisma.Decimal.Value))
        ) {
          couponDiscount = new Prisma.Decimal(coupon.maxDiscount as Prisma.Decimal.Value);
        }
      } else if (coupon.discountType === 'FIXED_AMOUNT') {
        couponDiscount = new Prisma.Decimal(coupon.discountValue as Prisma.Decimal.Value);
      }
      if (couponDiscount.greaterThan(subtotal)) {
        couponDiscount = subtotal;
      }
    }

    // Campaign promotions (rule engine): automatic ones always, plus the one
    // matching `promotionCode` if the shopper entered a code. Evaluated fresh
    // here so a promo that expired between "added to cart" and "pay" can't
    // still be honoured.
    const promoEvaluation = await PromotionEngine.evaluate({
      tenantId,
      items: await this.buildPromotionLineItems(tenantId, items),
      subtotal,
      shippingAmount: new Prisma.Decimal(0),
      isFirstOrder: customerId ? await this.isCustomersFirstOrder(tenantId, customerId) : false,
      code: promotionCode,
    });

    let discountAmount = couponDiscount.plus(promoEvaluation.discountAmount);
    if (discountAmount.greaterThan(subtotal)) discountAmount = subtotal;

    // Tax and shipping are stored per order but not yet calculated. Once
    // shipping is real, `promoEvaluation.freeShipping` zeroes it here.
    const taxAmount = new Prisma.Decimal(0);
    const shippingAmount = promoEvaluation.freeShipping
      ? new Prisma.Decimal(0)
      : new Prisma.Decimal(0);
    const totalAmount = subtotal.minus(discountAmount).plus(taxAmount).plus(shippingAmount);

    // Reserve stock. Dropship/print-on-demand variants (no InventoryLocation
    // for this tenant) have nothing to reserve — the supplier owns the
    // physical stock, so we just check the last-synced count and move on;
    // only first-party, warehouse-tracked variants get an actual reservation.
    for (const item of items) {
      const effectiveStock = await InventoryRepository.getEffectiveAvailableStock(
        tenantId,
        item.productVariantId,
      );
      if (effectiveStock.available < item.quantity) {
        return throwResponse(
          400,
          `Insufficient stock for ${item.productVariant?.title || item.productVariantId}`,
        );
      }
      if (effectiveStock.source === 'supplier') {
        continue;
      }
      const locationWithStock = effectiveStock.summary.locations.find(
        (loc: { available: number; locationId: string }) => loc.available >= item.quantity,
      );
      if (!locationWithStock) {
        return throwResponse(
          400,
          `No single location has enough stock for ${item.productVariant?.title || item.productVariantId}`,
        );
      }
      await InventoryRepository.reserveStock(
        tenantId,
        item.productVariantId,
        locationWithStock.locationId,
        item.quantity,
      );
    }

    return prisma.$transaction(async (tx) => {
      const createdOrder = await tx.commerceOrder.create({
        data: {
          tenant: { connect: { id: tenantId } },
          subtotal,
          discountAmount,
          taxAmount,
          shippingAmount,
          totalAmount,
          currency,
          status: OrderStatus.PENDING,
          // Guests are identified by their session so they can pay for and track
          // the order afterwards.
          ...(customerId ? { customer: { connect: { id: customerId } } } : { sessionId }),
          ...(shippingAddressId ? { shippingAddress: { connect: { id: shippingAddressId } } } : {}),
          ...(coupon ? { coupon: { connect: { id: coupon.id } } } : {}),
          ...(promoEvaluation.promotionId
            ? { promotion: { connect: { id: promoEvaluation.promotionId } } }
            : {}),
          items: {
            create: items.map((item: CartItemLike) => {
              const variant = item.productVariant;
              const imageUrl = variant?.media?.[0]?.url || null;
              return {
                tenantId: tenantId,
                productVariantId: item.productVariantId,
                quantity: item.quantity,
                unitPrice: new Prisma.Decimal(item.unitPrice as Prisma.Decimal.Value),
                productTitle: variant?.product?.title || 'Unknown Product',
                variantTitle: variant?.title,
                sku: variant?.sku,
                imageUrl: imageUrl,
              };
            }),
          },
        },
        include: {
          items: true,
          payments: { include: { events: true, attempts: true } },
        },
      });

      // Claim one use of every promotion this order applied, plus the coupon,
      // in the same transaction as order creation so a rolled-back checkout
      // never inflates a usage count.
      await PromotionRepository.incrementUsage(
        promoEvaluation.applied.map((a) => a.promotionId),
        tx,
      );
      if (coupon) await CouponRepository.incrementUsage(coupon.id, tx);

      if (params.afterCreate) await params.afterCreate(tx);

      return createdOrder;
    });
  }

  /**
   * Turns raw cart lines into what the promotion engine needs: each line's
   * product, category and collection membership, so PRODUCT/CATEGORY/
   * COLLECTION-scoped promotions can decide whether the line is in scope.
   */
  private static async buildPromotionLineItems(
    tenantId: string,
    items: CartItemLike[],
  ): Promise<PromotionLineItem[]> {
    const variantIds = items.map((i) => i.productVariantId);
    const variants = await prisma.catalogProductVariant.findMany({
      where: { id: { in: variantIds }, tenantId },
      select: {
        id: true,
        productId: true,
        product: {
          select: {
            categoryId: true,
            collectionItems: { select: { collectionId: true } },
          },
        },
      },
    });
    const byId = new Map(variants.map((v) => [v.id, v]));

    return items.map((item) => {
      const meta = byId.get(item.productVariantId);
      return {
        productVariantId: item.productVariantId,
        productId: meta?.productId ?? '',
        categoryId: meta?.product?.categoryId ?? null,
        collectionIds: meta?.product?.collectionItems.map((c) => c.collectionId) ?? [],
        quantity: item.quantity,
        unitPrice: new Prisma.Decimal(item.unitPrice as Prisma.Decimal.Value),
      };
    });
  }

  /** True when this customer has no earlier order in the tenant (for FIRST_ORDER rules). */
  private static async isCustomersFirstOrder(
    tenantId: string,
    customerId: string,
  ): Promise<boolean> {
    const count = await prisma.commerceOrder.count({ where: { tenantId, customerId } });
    return count === 0;
  }

  static async updateOrderStatus(orderId: string, status: OrderStatus) {
    if (!Object.values(OrderStatus).includes(status)) {
      return throwResponse(400, `Invalid order status '${status}'`);
    }

    // CANCELLED/REFUNDED carry real financial consequences (voiding or
    // returning a captured payment) that this generic endpoint has no way
    // to check — it would just relabel the order and fake-sync the payment
    // row without ever touching Stripe. Route those two through the
    // dedicated, guarded paths instead.
    if (status === OrderStatus.CANCELLED || status === OrderStatus.REFUNDED) {
      return throwResponse(
        400,
        'Use POST /orders/:id/cancel to cancel an order, or the Returns workflow to refund one',
      );
    }

    const tenantId = requireTenantId();

    const order = await OrderRepository.findById(tenantId, orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }
    return OrderRepository.updateStatus(tenantId, orderId, status);
  }

  /**
   * Cancels an order that hasn't been paid for yet. Once a payment has been
   * captured (PAID), cancelling here would silently strand the charge — the
   * admin has to go through the Returns workflow instead, which issues a
   * real Stripe refund (see ReturnService.issueRefund).
   */
  static async cancelOrder(orderId: string) {
    const tenantId = requireTenantId();
    const order = await OrderRepository.findById(tenantId, orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    const hasCapturedPayment = order.payments?.some((p) => p.status === PaymentStatus.PAID);
    if (hasCapturedPayment) {
      return throwResponse(409, 'Order has a captured payment — issue a refund instead');
    }

    return OrderRepository.updateStatus(tenantId, orderId, OrderStatus.CANCELLED);
  }

  static async getSupplierOrders(orderId: string) {
    return OrderRepository.getSupplierOrders(requireTenantId(), orderId);
  }

  static async updateShipment(shipmentId: string, status: string, trackingNumber?: string) {
    const shipment = await OrderRepository.updateShipment(
      requireTenantId(),
      shipmentId,
      status,
      trackingNumber,
    );
    if (!shipment) return throwResponse(404, 'Shipment not found');
    return shipment;
  }
}
