/**
 * Pricing Utility for Platform-wide commissions.
 * In a centralized marketplace, this determines the final selling price
 * that customers will see and pay, based on the supplier's cost.
 */

import { PricingRule } from '@prisma/client';

export class PricingUtil {
  /**
   * Calculates the final platform selling price.
   *
   * @param costPrice The base cost from the supplier
   * @param rule The dynamic pricing rule from the database
   * @returns The final selling price
   */
  static calculatePlatformPrice(costPrice: number | string, rule?: PricingRule | null): number {
    const cost = typeof costPrice === 'string' ? parseFloat(costPrice) : costPrice;
    if (isNaN(cost) || cost <= 0) {
      return cost || 0;
    }

    let sellingPrice = cost;

    if (rule) {
      const markupValue = Number(rule.markupValue);
      if (rule.markupType === 'PERCENTAGE') {
        sellingPrice = cost * (1 + markupValue / 100);
      } else if (rule.markupType === 'FIXED_AMOUNT') {
        sellingPrice = cost + markupValue;
      }

      if (rule.minimumProfit) {
        const minProfit = Number(rule.minimumProfit);
        if (sellingPrice - cost < minProfit) {
          sellingPrice = cost + minProfit;
        }
      }
    } else {
      const MARKUP_PERCENTAGE = 0.3; // 30% markup fallback
      sellingPrice = cost * (1 + MARKUP_PERCENTAGE);
    }

    // Round to 2 decimal places (e.g. 14.99)
    return Math.round(sellingPrice * 100) / 100;
  }
}
