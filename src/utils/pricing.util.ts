import { CatalogPricingRule, MarkupType } from '@prisma/client';

/**
 * A pricing rule's time-boxed sale — mirrors CatalogPricingRule's
 * `sale*` columns, passed in here as plain data so this file stays free of
 * any storage-layer (Prisma) dependency.
 */
export interface PricingRuleSaleConfig {
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  startsAt: string; // ISO
  endsAt: string; // ISO
}

export function isSaleCurrentlyActive(sale: Pick<PricingRuleSaleConfig, 'startsAt' | 'endsAt'>): boolean {
  const now = Date.now();
  return now >= new Date(sale.startsAt).getTime() && now <= new Date(sale.endsAt).getTime();
}

/** Discounts an already-calculated selling price by a sale's %/$ off — never below 0. */
export function calculateSalePrice(
  regularPrice: number,
  sale: Pick<PricingRuleSaleConfig, 'type' | 'value'>,
): number {
  const discounted =
    sale.type === 'PERCENTAGE' ? regularPrice * (1 - sale.value / 100) : regularPrice - sale.value;

  const clamped = Math.max(0, discounted);
  return Math.round((clamped + Number.EPSILON) * 100) / 100;
}

export interface PricingCalculationResult {
  baseCost: number;
  calculatedPrice: number;
  profitMargin: number;
  appliedRuleId?: string;
}

export function calculateVariantPrice(
  baseCost: number,
  rule?: CatalogPricingRule | null,
): PricingCalculationResult {
  if (!rule || !rule.isActive) {
    return {
      baseCost,
      calculatedPrice: baseCost,
      profitMargin: 0,
    };
  }

  let calculatedPrice = baseCost;

  if (rule.markupType === MarkupType.PERCENTAGE) {
    const markupMultiplier = 1 + Number(rule.markupValue) / 100;
    calculatedPrice = baseCost * markupMultiplier;
  } else if (rule.markupType === MarkupType.FIXED_AMOUNT) {
    calculatedPrice = baseCost + Number(rule.markupValue);
  }

  if (rule.minimumProfit) {
    const minProfit = Number(rule.minimumProfit);
    if (calculatedPrice - baseCost < minProfit) {
      calculatedPrice = baseCost + minProfit;
    }
  }

  const roundedPrice = Math.round((calculatedPrice + Number.EPSILON) * 100) / 100;
  const profitMargin = Math.round((roundedPrice - baseCost + Number.EPSILON) * 100) / 100;

  return {
    baseCost,
    calculatedPrice: roundedPrice,
    profitMargin,
    appliedRuleId: rule.id,
  };
}
