import { randomUUID } from 'crypto';
import OrderRepository from './order.repository';
import CartRepository from './cart.repository';
import CustomerRepository from './customer.repository';
import CouponRepository from './coupon.repository';
import CouponService from './coupon.service';
import PromotionRepository from '../promotion/promotion.repository';
import PromotionEngine, { PromotionLineItem } from '../promotion/promotion.engine';
import InventoryRepository from '../inventory/inventory.repository';
import NotificationRepository from '../system/notification.repository';
import SupplierRepository from '../supplier/supplier.repository';
import { CJDropshippingAdapter } from '../../suppliers/cj-dropshipping/cj.adapter';
import { OrderStatus, PaymentStatus, Prisma, Coupon } from '@prisma/client';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';
import { prisma } from '../../utils/prisma';
import CacheUtil from '../../utils/cache.util';
import logger from '../../utils/logger';

const CJ_SUPPLIER_NAME = 'cj-dropshipping';
const SHIPPING_QUOTE_TTL_SECONDS = 900; // 15 min — long enough to cover checkout, short enough that a stale price never survives to a much-later retry.
const DEFAULT_FREIGHT_ORIGIN_COUNTRY = 'CN'; // Matches CJDropshippingAdapter's own DEFAULT_FROM_COUNTRY_CODE.
const MAX_DEFAULT_DELIVERY_DAYS = 14; // ~2 weeks — the slowest a *default-selected* option may be; slower ones still show up, just not pre-picked.

/**
 * Pulls the slower end of a CJ `aging` string (e.g. "6-9", "12-50") — the
 * number that matters for "will this actually arrive within N days" is the
 * upper bound, not the optimistic one. Returns null for anything
 * unparseable (including the fallback option, which has no aging at all),
 * so it never accidentally qualifies as fast.
 */
function parseMaxDeliveryDays(aging?: string): number | null {
  if (!aging) return null;
  const match = aging.match(/(\d+)(?:\D+(\d+))?/);
  if (!match) return null;
  return Number(match[2] ?? match[1]);
}

/** One shipping method a customer can choose at checkout, with its real price. */
export interface ShippingQuoteOption {
  logisticName: string;
  price: number;
  aging?: string;
}

export interface ShippingQuoteResult {
  quoteId: string | null;
  options: ShippingQuoteOption[];
  /** 'cj-dropshipping' when every item was live-quoted; 'fallback' when some/all items aren't sourced from a supplier this can quote yet (see getShippingQuote's doc comment). */
  source: 'cj-dropshipping' | 'fallback';
}

/**
 * Flat placeholder used only when a cart can't be live-quoted (see
 * getShippingQuote) — e.g. a first-party item, or one not yet mapped to a
 * supplier. Better than blocking checkout entirely; worth revisiting once
 * non-CJ catalog items are common enough for this to matter.
 */
const FALLBACK_SHIPPING_OPTION: ShippingQuoteOption = {
  logisticName: 'Standard Shipping',
  price: 9.99,
};

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
    shippingQuoteId?: string;
    shippingLogisticName?: string;
  }) {
    const {
      customerId,
      sessionId,
      shippingAddressId,
      couponCode,
      promotionCode,
      currency = 'USD',
      shippingQuoteId,
      shippingLogisticName,
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
      shippingQuoteId,
      shippingLogisticName,
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
    shippingQuoteId?: string;
    shippingLogisticName?: string;
  }) {
    const {
      customerId,
      userId,
      items,
      shippingAddressId,
      couponCode,
      promotionCode,
      currency = 'USD',
      shippingQuoteId,
      shippingLogisticName,
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
      shippingQuoteId,
      shippingLogisticName,
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
   * Live shipping quote for a would-be checkoutDirect cart — called from the
   * checkout page once a destination is known, before the customer pays.
   * Resolves each {productId,size,color} to a real variant (same matching
   * checkoutDirect itself uses), maps those variants to CJ Dropshipping's
   * own variant ids, and asks CJ for real prices via calculateFreight.
   *
   * Deliberately CJ-only for this first pass, same simplification
   * CJOrderFulfillmentService already makes for placing the supplier order
   * itself: if any item in the cart isn't CJ-sourced (unmapped — e.g.
   * first-party stock, or a supplier integration added later), there's no
   * live rate to ask for, so this falls back to FALLBACK_SHIPPING_OPTION
   * rather than blocking checkout. Splitting a mixed-supplier cart's
   * shipping into multiple quotes is future work, same as fulfillment.
   *
   * The returned quoteId must be round-tripped back into checkoutDirect
   * (as shippingQuoteId) to actually charge this price — see
   * resolveQuotedShipping. Options are cached server-side specifically so
   * checkout never has to trust a price the client sends back.
   */
  static async getShippingQuote(params: {
    items: { productId: string; size?: string; color?: string; quantity: number }[];
    countryCode: string;
    zip?: string;
  }): Promise<ShippingQuoteResult> {
    const tenantId = requireTenantId();
    const resolvedItems = await this.resolveDirectCheckoutItems(tenantId, params.items);

    const variantIds = resolvedItems.map((item) => item.productVariantId);
    const vidByVariantId = await SupplierRepository.findVariantMappingsBySupplier(
      CJ_SUPPLIER_NAME,
      variantIds,
    );

    const allMapped = resolvedItems.every((item) => vidByVariantId.has(item.productVariantId));

    let options: ShippingQuoteOption[];
    let source: ShippingQuoteResult['source'];

    if (!allMapped) {
      logger.warn(
        '[OrderService:getShippingQuote] One or more items are not sourced from ' +
          `${CJ_SUPPLIER_NAME} — falling back to a flat shipping rate for this quote.`,
      );
      options = [FALLBACK_SHIPPING_OPTION];
      source = 'fallback';
    } else {
      const cjAdapter = new CJDropshippingAdapter();
      const freightOptions = await cjAdapter.calculateFreight({
        startCountryCode: DEFAULT_FREIGHT_ORIGIN_COUNTRY,
        endCountryCode: params.countryCode,
        zip: params.zip,
        products: resolvedItems.map((item) => ({
          vid: vidByVariantId.get(item.productVariantId) as string,
          quantity: item.quantity,
        })),
      });

      if (freightOptions.length === 0) {
        logger.warn(
          '[OrderService:getShippingQuote] CJ returned no freight options — falling back to a flat rate.',
        );
        options = [FALLBACK_SHIPPING_OPTION];
        source = 'fallback';
      } else {
        // options[0] is what checkout pre-selects (see resolveQuotedShipping
        // and CheckoutPage.tsx), so this ordering *is* the default-pick
        // rule: cheapest among methods that arrive within
        // MAX_DEFAULT_DELIVERY_DAYS, falling back to cheapest overall only
        // when nothing qualifies. Slower/unparseable options aren't
        // dropped — they still show up in the "Change" list, just ranked
        // after the ones that qualify.
        options = freightOptions
          .map((o) => ({
            logisticName: o.logisticName,
            price: Number(o.logisticPrice),
            aging: o.logisticAging,
          }))
          .sort((a, b) => {
            const aDays = parseMaxDeliveryDays(a.aging);
            const bDays = parseMaxDeliveryDays(b.aging);
            const aQualifies = aDays !== null && aDays <= MAX_DEFAULT_DELIVERY_DAYS;
            const bQualifies = bDays !== null && bDays <= MAX_DEFAULT_DELIVERY_DAYS;
            if (aQualifies !== bQualifies) return aQualifies ? -1 : 1;
            return a.price - b.price;
          });
        source = 'cj-dropshipping';
      }
    }

    const quoteId = randomUUID();
    await CacheUtil.set(`shipping:quote:${tenantId}:${quoteId}`, { options }, SHIPPING_QUOTE_TTL_SECONDS);

    return { quoteId, options, source };
  }

  /**
   * Re-reads a quote produced by getShippingQuote and picks the option the
   * customer selected — the price actually charged always comes from here,
   * never from anything the client sends directly, same principle as the
   * Stripe PaymentIntent amount always being derived server-side. Returns
   * null when the quote has expired or `logisticName` doesn't match any
   * cached option, so the caller can ask the customer to recalculate rather
   * than silently charging the wrong (or no) shipping fee.
   */
  private static async resolveQuotedShipping(
    quoteId: string,
    logisticName?: string,
  ): Promise<ShippingQuoteOption | null> {
    const tenantId = requireTenantId();
    const cached = await CacheUtil.get<{ options: ShippingQuoteOption[] }>(
      `shipping:quote:${tenantId}:${quoteId}`,
    );
    if (!cached || cached.options.length === 0) return null;

    if (!logisticName) return cached.options[0];
    return cached.options.find((o) => o.logisticName === logisticName) ?? null;
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
      shippingQuoteId?: string;
      shippingLogisticName?: string;
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
      shippingQuoteId,
      shippingLogisticName,
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

    // Tax isn't calculated yet — still a real gap, unrelated to shipping.
    const taxAmount = new Prisma.Decimal(0);

    // Shipping comes from a quote produced by getShippingQuote and cached
    // server-side under its quoteId — never from a raw price the client
    // sends, for the same reason the Stripe PaymentIntent amount is always
    // derived server-side. No quoteId at all (e.g. an older client, or
    // checkoutFromCart's guest flow before it's wired into a quote step)
    // means "no real shipping charge yet," same as before this existed.
    let shippingAmount = new Prisma.Decimal(0);
    if (shippingQuoteId) {
      const quoted = await this.resolveQuotedShipping(shippingQuoteId, shippingLogisticName);
      if (!quoted) {
        return throwResponse(
          400,
          'Shipping quote has expired or is no longer valid — please recalculate shipping and try again',
        );
      }
      shippingAmount = new Prisma.Decimal(quoted.price);
    }
    if (promoEvaluation.freeShipping) shippingAmount = new Prisma.Decimal(0);

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
   * Cancels an order that hasn't been paid for yet, and hasn't already been
   * placed with a supplier. Once a payment has been captured (PAID),
   * cancelling here would silently strand the charge — the admin has to go
   * through the Returns workflow instead, which issues a real Stripe refund
   * (see ReturnService.issueRefund). Once a CommerceSupplierOrder exists
   * (see CJOrderFulfillmentService.placeOrder), real money has already been
   * spent placing/paying for it with the supplier — cancelling the
   * CommerceOrder here wouldn't tell the supplier to stop, and wouldn't get
   * that money back, so the same "go through Returns instead" rule applies
   * even if the customer's own payment happens to not be PAID yet (e.g.
   * cash-on-delivery).
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

    if (order.supplierOrders?.length > 0) {
      return throwResponse(
        409,
        'Order has already been placed with a supplier — issue a refund instead',
      );
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
