import { Prisma } from '@prisma/client';
import PromotionRepository from './promotion.repository';
import logger from '../../utils/logger';

/**
 * PROMOTION ENGINE
 *
 * Given a cart snapshot, works out which active promotions apply and how much
 * they take off. Pure computation on top of a single repository read — no
 * writes, no request context — so it can be unit-tested with a mocked
 * repository and called from any checkout path.
 *
 * What it supports today:
 *   rules   — MIN_CART_TOTAL, MIN_QUANTITY, FIRST_ORDER
 *   rewards — PERCENTAGE_OFF (with maxDiscount cap), FIXED_AMOUNT_OFF, FREE_SHIPPING
 *   targets — ALL, PRODUCT, VARIANT, COLLECTION, CATEGORY
 *
 * Deliberately not yet handled (logged and skipped, never silently "applied"):
 *   rules   — CUSTOMER_GROUP (no customer-group model wired up)
 *   rewards — BUY_X_GET_Y
 *
 * Stacking: every qualifying promotion is applied, in `priority` order
 * (highest first, then oldest first). Each one's discount is computed against
 * its own targeted subtotal but capped so the running total can never exceed
 * the cart subtotal. FREE_SHIPPING is tracked as a flag. The order is stamped
 * with the first promotion that actually moved the price (see `promotionId`).
 */

const ZERO = new Prisma.Decimal(0);

export interface PromotionLineItem {
  productVariantId: string;
  productId: string;
  categoryId: string | null;
  collectionIds: string[];
  quantity: number;
  unitPrice: Prisma.Decimal;
}

export interface PromotionContext {
  tenantId: string;
  items: PromotionLineItem[];
  subtotal: Prisma.Decimal;
  shippingAmount: Prisma.Decimal;
  /** True when this is the customer's very first order in the tenant. */
  isFirstOrder: boolean;
  /** Promo code the shopper entered, if any. Case-insensitive. */
  code?: string | null;
}

export interface AppliedPromotion {
  promotionId: string;
  title: string;
  code: string | null;
  rewardType: string;
  /** Money taken off by this promotion. 0 for a FREE_SHIPPING-only promo. */
  discountAmount: Prisma.Decimal;
  freeShipping: boolean;
}

export interface PromotionEvaluation {
  applied: AppliedPromotion[];
  /** Combined discount across all applied promotions, never more than subtotal. */
  discountAmount: Prisma.Decimal;
  freeShipping: boolean;
  /**
   * The promotion to record on the order's `promotionId` — the first applied
   * one that reduced the price, or the first applied FREE_SHIPPING promo if
   * nothing reduced the price. Null when nothing applied.
   */
  promotionId: string | null;
}

type PromotionWithRelations = Awaited<
  ReturnType<typeof PromotionRepository.findActiveCandidates>
>[number];

type RuleRow = PromotionWithRelations['rules'][number];
type TargetRow = PromotionWithRelations['targets'][number];

function lineTotal(item: PromotionLineItem): Prisma.Decimal {
  return item.unitPrice.times(item.quantity);
}

function cartQuantity(items: PromotionLineItem[]): number {
  return items.reduce((n, i) => n + i.quantity, 0);
}

/** Reads a numeric field off a rule's free-form `condition` JSON. */
function conditionNumber(rule: RuleRow, key: string): number | null {
  const condition = rule.condition as Record<string, unknown> | null;
  const raw = condition?.[key];
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN;
  return Number.isFinite(n) ? n : null;
}

function rulePasses(rule: RuleRow, ctx: PromotionContext): boolean {
  switch (rule.ruleType) {
    case 'MIN_CART_TOTAL': {
      const min = conditionNumber(rule, 'minTotal');
      return min == null ? false : ctx.subtotal.greaterThanOrEqualTo(min);
    }
    case 'MIN_QUANTITY': {
      const min = conditionNumber(rule, 'minQty');
      return min == null ? false : cartQuantity(ctx.items) >= min;
    }
    case 'FIRST_ORDER':
      return ctx.isFirstOrder;
    case 'CUSTOMER_GROUP':
      logger.warn(
        `[promotion.engine] CUSTOMER_GROUP rule is not supported yet — treating as not met`,
      );
      return false;
    default:
      logger.warn(`[promotion.engine] unknown ruleType "${rule.ruleType}" — treating as not met`);
      return false;
  }
}

/**
 * Sum of the line items a promotion's targets point at. No targets, or an
 * ALL target, means the whole cart.
 */
function targetedSubtotal(items: PromotionLineItem[], targets: TargetRow[]): Prisma.Decimal {
  if (targets.length === 0 || targets.some((t) => t.targetType === 'ALL')) {
    return items.reduce((acc, i) => acc.plus(lineTotal(i)), ZERO);
  }

  const ids = (type: string) =>
    new Set(targets.filter((t) => t.targetType === type && t.targetId).map((t) => t.targetId!));

  const productIds = ids('PRODUCT');
  const variantIds = ids('VARIANT');
  const collectionIds = ids('COLLECTION');
  const categoryIds = ids('CATEGORY');

  return items.reduce((acc, item) => {
    const hit =
      variantIds.has(item.productVariantId) ||
      productIds.has(item.productId) ||
      (item.categoryId != null && categoryIds.has(item.categoryId)) ||
      item.collectionIds.some((c) => collectionIds.has(c));
    return hit ? acc.plus(lineTotal(item)) : acc;
  }, ZERO);
}

/** Discount a single reward yields against an already-resolved targeted subtotal. */
function rewardDiscount(
  reward: PromotionWithRelations['rewards'][number],
  targeted: Prisma.Decimal,
): { discount: Prisma.Decimal; freeShipping: boolean } {
  const value = new Prisma.Decimal(reward.value as Prisma.Decimal.Value);

  switch (reward.rewardType) {
    case 'PERCENTAGE_OFF': {
      let d = targeted.times(value).dividedBy(100);
      if (reward.maxDiscount != null) {
        const cap = new Prisma.Decimal(reward.maxDiscount as Prisma.Decimal.Value);
        if (d.greaterThan(cap)) d = cap;
      }
      return { discount: d, freeShipping: false };
    }
    case 'FIXED_AMOUNT_OFF':
      return { discount: value.greaterThan(targeted) ? targeted : value, freeShipping: false };
    case 'FREE_SHIPPING':
      return { discount: ZERO, freeShipping: true };
    case 'BUY_X_GET_Y':
      logger.warn(`[promotion.engine] BUY_X_GET_Y reward is not supported yet — skipped`);
      return { discount: ZERO, freeShipping: false };
    default:
      logger.warn(`[promotion.engine] unknown rewardType "${reward.rewardType}" — skipped`);
      return { discount: ZERO, freeShipping: false };
  }
}

export default class PromotionEngine {
  static async evaluate(ctx: PromotionContext): Promise<PromotionEvaluation> {
    const empty: PromotionEvaluation = {
      applied: [],
      discountAmount: ZERO,
      freeShipping: false,
      promotionId: null,
    };

    if (ctx.items.length === 0 || ctx.subtotal.lessThanOrEqualTo(0)) return empty;

    const candidates = await PromotionRepository.findActiveCandidates(
      ctx.tenantId,
      ctx.code ?? undefined,
    );
    if (candidates.length === 0) return empty;

    const applied: AppliedPromotion[] = [];
    let remaining = ctx.subtotal;
    let totalDiscount = ZERO;
    let freeShipping = false;
    let promotionId: string | null = null;

    for (const promo of candidates) {
      if (remaining.lessThanOrEqualTo(0)) break;

      // All rules must pass (AND). A promo with no rules always qualifies.
      if (!promo.rules.every((rule) => rulePasses(rule, ctx))) continue;

      const targeted = targetedSubtotal(ctx.items, promo.targets);
      if (
        targeted.lessThanOrEqualTo(0) &&
        promo.rewards.every((r) => r.rewardType !== 'FREE_SHIPPING')
      )
        continue;

      let promoDiscount = ZERO;
      let promoFreeShipping = false;
      for (const reward of promo.rewards) {
        const { discount, freeShipping: fs } = rewardDiscount(reward, targeted);
        promoDiscount = promoDiscount.plus(discount);
        promoFreeShipping = promoFreeShipping || fs;
      }

      // Never let the running total of discounts exceed the cart subtotal.
      if (promoDiscount.greaterThan(remaining)) promoDiscount = remaining;

      if (promoDiscount.lessThanOrEqualTo(0) && !promoFreeShipping) continue;

      applied.push({
        promotionId: promo.id,
        title: promo.title,
        code: promo.code,
        rewardType: promo.rewards[0]?.rewardType ?? 'UNKNOWN',
        discountAmount: promoDiscount,
        freeShipping: promoFreeShipping,
      });

      remaining = remaining.minus(promoDiscount);
      totalDiscount = totalDiscount.plus(promoDiscount);
      freeShipping = freeShipping || promoFreeShipping;

      if (promotionId == null && (promoDiscount.greaterThan(0) || promoFreeShipping)) {
        promotionId = promo.id;
      }
    }

    return { applied, discountAmount: totalDiscount, freeShipping, promotionId };
  }
}
