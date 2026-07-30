import { CatalogPricingRule, MarkupType } from '@prisma/client';

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
