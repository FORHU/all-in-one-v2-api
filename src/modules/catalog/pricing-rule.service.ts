import { prisma } from '../../utils/prisma';
import { requireTenantId } from '../../utils/async-context';
import { throwResponse } from '../../utils/throw-response';
import {
  calculateVariantPrice,
  calculateSalePrice,
  isSaleCurrentlyActive,
  PricingRuleSaleConfig,
} from '../../utils/pricing.util';
import PricingRuleRepository, { PricingRuleRow } from './pricing-rule.repository';

export interface PricingRuleWriteInput {
  name: string;
  markupValue: number;
  minimumProfit?: number | null;
  // `undefined` = leave the sale as-is (update only). `null` = clear it.
  // A present object = set/replace it.
  sale?: PricingRuleSaleConfig | null;
}

export interface PricingRuleSaleDto extends PricingRuleSaleConfig {
  isActive: boolean;
}

export interface PricingRuleDto {
  id: string;
  name: string;
  markupValue: number;
  minimumProfit: number | null;
  isActive: boolean;
  isDefault: boolean;
  productCount: number;
  sale: PricingRuleSaleDto | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Reassembles a rule's sale from its 4 columns — `saleType` is the presence flag; the other 3 are meaningless without it. */
function ruleSaleFromRow(row: {
  saleType: PricingRuleRow['saleType'];
  saleValue: PricingRuleRow['saleValue'];
  saleStartsAt: PricingRuleRow['saleStartsAt'];
  saleEndsAt: PricingRuleRow['saleEndsAt'];
}): PricingRuleSaleConfig | null {
  if (!row.saleType || row.saleValue == null || !row.saleStartsAt || !row.saleEndsAt) return null;
  return {
    type: row.saleType,
    value: row.saleValue.toNumber(),
    startsAt: row.saleStartsAt.toISOString(),
    endsAt: row.saleEndsAt.toISOString(),
  };
}

function toDto(row: PricingRuleRow): PricingRuleDto {
  const sale = ruleSaleFromRow(row);
  return {
    id: row.id,
    name: row.name,
    markupValue: row.markupValue.toNumber(),
    minimumProfit: row.minimumProfit?.toNumber() ?? null,
    isActive: row.isActive,
    isDefault: row.isDefault,
    productCount: row._count.products,
    sale: sale ? { ...sale, isActive: isSaleCurrentlyActive(sale) } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/** Throws if a sale's window is malformed — end must be a real date after start. */
function validateSaleWindow(sale: PricingRuleSaleConfig): void {
  const start = new Date(sale.startsAt).getTime();
  const end = new Date(sale.endsAt).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) {
    return throwResponse(400, 'Sale start/end must be valid dates');
  }
  if (end <= start) {
    return throwResponse(400, 'Sale end date must be after the start date');
  }
}

export default class PricingRuleService {
  static async listRules(): Promise<PricingRuleDto[]> {
    const tenantId = requireTenantId();
    const rules = await PricingRuleRepository.findAll(tenantId);
    return rules.map((r) => toDto(r));
  }

  static async createRule(data: PricingRuleWriteInput): Promise<PricingRuleDto> {
    const tenantId = requireTenantId();

    const existing = await PricingRuleRepository.findByName(tenantId, data.name.trim());
    if (existing) {
      return throwResponse(400, `A pricing rule named "${data.name.trim()}" already exists`);
    }

    if (data.sale) validateSaleWindow(data.sale);

    const created = await PricingRuleRepository.create(tenantId, {
      name: data.name.trim(),
      markupType: 'PERCENTAGE',
      markupValue: data.markupValue,
      minimumProfit: data.minimumProfit ?? null,
      saleType: data.sale?.type ?? null,
      saleValue: data.sale?.value ?? null,
      saleStartsAt: data.sale ? new Date(data.sale.startsAt) : null,
      saleEndsAt: data.sale ? new Date(data.sale.endsAt) : null,
    });

    return toDto(created);
  }

  static async updateRule(
    id: string,
    data: Partial<PricingRuleWriteInput>,
  ): Promise<PricingRuleDto> {
    const tenantId = requireTenantId();

    const rule = await PricingRuleRepository.findById(tenantId, id);
    if (!rule) return throwResponse(404, 'Pricing rule not found');

    if (data.name && data.name.trim() !== rule.name) {
      const existing = await PricingRuleRepository.findByName(tenantId, data.name.trim());
      if (existing) {
        return throwResponse(400, `A pricing rule named "${data.name.trim()}" already exists`);
      }
    }

    if (data.sale) validateSaleWindow(data.sale);

    const updated = await PricingRuleRepository.update(tenantId, id, {
      ...(data.name !== undefined && { name: data.name.trim() }),
      ...(data.markupValue !== undefined && { markupValue: data.markupValue }),
      ...(data.minimumProfit !== undefined && { minimumProfit: data.minimumProfit }),
      // `undefined` = leave the sale columns untouched. `null` or an object
      // = replace all 4 columns together (never a partial sale update).
      ...(data.sale !== undefined && {
        saleType: data.sale?.type ?? null,
        saleValue: data.sale?.value ?? null,
        saleStartsAt: data.sale ? new Date(data.sale.startsAt) : null,
        saleEndsAt: data.sale ? new Date(data.sale.endsAt) : null,
      }),
    });

    // Anything that changes the resulting price — markup, minimum profit, or
    // the sale — needs every product still on this rule recomputed
    // immediately, not just on the next import. Independent per product, so
    // these run concurrently rather than one sequential round trip at a time.
    if (
      data.markupValue !== undefined ||
      data.minimumProfit !== undefined ||
      data.sale !== undefined
    ) {
      const productIds = await PricingRuleRepository.findProductIdsUsingRule(tenantId, id);
      await Promise.all(
        productIds.map((productId) => this.recalculateProductPricing(tenantId, productId)),
      );
    }

    return toDto(updated!);
  }

  static async deleteRule(id: string) {
    const tenantId = requireTenantId();

    const rule = await PricingRuleRepository.findById(tenantId, id);
    if (!rule) return throwResponse(404, 'Pricing rule not found');

    if (rule.isDefault) {
      return throwResponse(
        400,
        'This is the default pricing rule — set another rule as default before deleting it.',
      );
    }

    const productCount = await PricingRuleRepository.countProductsUsingRule(tenantId, id);
    if (productCount > 0) {
      return throwResponse(
        400,
        `Cannot delete — ${productCount} product${productCount === 1 ? '' : 's'} still use this rule. Reassign them first.`,
      );
    }

    await PricingRuleRepository.delete(tenantId, id);
  }

  /**
   * Makes this rule the tenant's default and sweeps every product that has
   * no explicit rule of its own (or was riding the previous default) onto
   * it, then recalculates their prices immediately. Products carrying a
   * different, deliberately-assigned rule are left alone.
   */
  static async applyToAll(id: string) {
    const tenantId = requireTenantId();

    const rule = await PricingRuleRepository.findById(tenantId, id);
    if (!rule) return throwResponse(404, 'Pricing rule not found');

    const previousDefault = await PricingRuleRepository.findDefault(tenantId);
    const previousDefaultId =
      previousDefault && previousDefault.id !== id ? previousDefault.id : null;

    const eligibleProductIds = await PricingRuleRepository.findProductIdsEligibleForDefault(
      tenantId,
      previousDefaultId,
    );

    // Becoming the default and sweeping eligible products onto it must
    // happen atomically — otherwise a crash between "clear the old default"
    // and "set the new one" leaves the tenant with no default rule at all
    // until someone retries.
    await prisma.$transaction(async (tx) => {
      await PricingRuleRepository.clearDefault(tenantId, id, tx);
      await PricingRuleRepository.update(tenantId, id, { isDefault: true }, tx);
      await PricingRuleRepository.assignRuleToProducts(tenantId, id, eligibleProductIds, tx);
    });

    // Recalculate every product now on this rule — both the ones just swept
    // in and any that were already explicitly assigned to it, in case its
    // percentage changed since they were last recalculated. Left outside the
    // transaction above (same reasoning as import's live-stock fetch): this
    // can touch many products and shouldn't hold a DB transaction open.
    const allAffectedProductIds = await PricingRuleRepository.findProductIdsUsingRule(tenantId, id);
    await Promise.all(
      allAffectedProductIds.map((productId) => this.recalculateProductPricing(tenantId, productId)),
    );

    return { updatedCount: eligibleProductIds.length };
  }

  /**
   * Recomputes a product's variant prices from their stored `baseCost` using
   * whichever pricing rule the product currently has assigned (or no markup
   * at all if none), then layers the rule's sale on top (if one is
   * configured AND currently within its window) to set `salePrice`.
   * Variants with no `baseCost` — i.e. manually created, never linked to a
   * supplier — are left exactly as the admin typed them; there's no cost
   * basis to mark up.
   */
  static async recalculateProductPricing(tenantId: string, productId: string): Promise<void> {
    const product = await prisma.catalogProduct.findFirst({
      where: { id: productId, tenantId },
      include: { pricingRule: true },
    });
    if (!product) return;

    const variants = await prisma.catalogProductVariant.findMany({
      where: { productId, tenantId, deletedAt: null },
    });
    if (variants.length === 0) return;

    // One price per variant, in the same order as `variants` — recalculated
    // ones come back from the update; skipped ones (no cost basis) keep
    // whatever they already had. Avoids a second full re-fetch of every
    // variant just to work out the product's new lowest price.
    const finalPrices = await Promise.all(
      variants.map(async (variant) => {
        if (variant.baseCost == null) return variant.price.toNumber();

        const cost = variant.baseCost.toNumber();
        const result = calculateVariantPrice(cost, product.pricingRule);
        const updated = await prisma.catalogProductVariant.update({
          where: { id: variant.id },
          data: { calculatedPrice: result.calculatedPrice, price: result.calculatedPrice },
        });
        return updated.price.toNumber();
      }),
    );

    const regularPrice = Math.min(...finalPrices);
    const sale = product.pricingRule ? ruleSaleFromRow(product.pricingRule) : null;
    const salePrice =
      sale && isSaleCurrentlyActive(sale) ? calculateSalePrice(regularPrice, sale) : null;

    await prisma.catalogProduct.updateMany({
      where: { id: productId, tenantId },
      data: { price: regularPrice, salePrice },
    });
  }
}
