import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

const WITH_PRODUCT_COUNT = {
  _count: { select: { products: true } },
} satisfies Prisma.CatalogPricingRuleInclude;

export type PricingRuleRow = Prisma.CatalogPricingRuleGetPayload<{
  include: typeof WITH_PRODUCT_COUNT;
}>;

/**
 * Every method takes `tenantId` explicitly — same convention as
 * ProductRepository/CategoryRepository. Pricing rules are a plain
 * tenant-scoped table, no nested-resource ownership checks needed.
 */
export default class PricingRuleRepository {
  static async findAll(tenantId: string): Promise<PricingRuleRow[]> {
    return prisma.catalogPricingRule.findMany({
      where: { tenantId },
      include: WITH_PRODUCT_COUNT,
      orderBy: { createdAt: 'asc' },
    });
  }

  static async findById(
    tenantId: string,
    id: string,
    client: PrismaClientOrTx = prisma,
  ): Promise<PricingRuleRow | null> {
    return client.catalogPricingRule.findFirst({
      where: { id, tenantId },
      include: WITH_PRODUCT_COUNT,
    });
  }

  static async findDefault(tenantId: string) {
    return prisma.catalogPricingRule.findFirst({ where: { tenantId, isDefault: true } });
  }

  static async findByName(tenantId: string, name: string) {
    return prisma.catalogPricingRule.findFirst({ where: { tenantId, name } });
  }

  static async create(
    tenantId: string,
    data: Omit<Prisma.CatalogPricingRuleUncheckedCreateInput, 'tenantId'>,
  ): Promise<PricingRuleRow> {
    const created = await prisma.catalogPricingRule.create({ data: { ...data, tenantId } });
    return (await this.findById(tenantId, created.id))!;
  }

  /**
   * Tenant-safe `updateMany` + refetch, same idiom as ProductRepository.update.
   * Accepts an injectable client so it can participate in a caller's
   * transaction (e.g. PricingRuleService.applyToAll's default swap).
   */
  static async update(
    tenantId: string,
    id: string,
    data: Prisma.CatalogPricingRuleUncheckedUpdateManyInput,
    client: PrismaClientOrTx = prisma,
  ): Promise<PricingRuleRow | null> {
    await client.catalogPricingRule.updateMany({ where: { id, tenantId }, data });
    return this.findById(tenantId, id, client);
  }

  /** Unsets `isDefault` on every OTHER rule for this tenant — call before marking a new one default. */
  static async clearDefault(
    tenantId: string,
    exceptId: string,
    client: PrismaClientOrTx = prisma,
  ): Promise<void> {
    await client.catalogPricingRule.updateMany({
      where: { tenantId, isDefault: true, id: { not: exceptId } },
      data: { isDefault: false },
    });
  }

  static async delete(tenantId: string, id: string): Promise<void> {
    await prisma.catalogPricingRule.deleteMany({ where: { id, tenantId } });
  }

  static async countProductsUsingRule(tenantId: string, ruleId: string): Promise<number> {
    return prisma.catalogProduct.count({
      where: { tenantId, pricingRuleId: ruleId, deletedAt: null },
    });
  }

  static async findProductIdsUsingRule(tenantId: string, ruleId: string): Promise<string[]> {
    const rows = await prisma.catalogProduct.findMany({
      where: { tenantId, pricingRuleId: ruleId, deletedAt: null },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /**
   * Products eligible to be swept onto a new default: never assigned a rule,
   * or still sitting on whatever the PREVIOUS default was. A product
   * pointing at some other, explicitly-chosen rule is left untouched —
   * that's the "leave overridden products alone" behavior "apply to all"
   * promises.
   */
  static async findProductIdsEligibleForDefault(
    tenantId: string,
    previousDefaultRuleId: string | null,
  ): Promise<string[]> {
    const rows = await prisma.catalogProduct.findMany({
      where: {
        tenantId,
        deletedAt: null,
        OR: [
          { pricingRuleId: null },
          ...(previousDefaultRuleId ? [{ pricingRuleId: previousDefaultRuleId }] : []),
        ],
      },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  static async assignRuleToProducts(
    tenantId: string,
    ruleId: string,
    productIds: string[],
    client: PrismaClientOrTx = prisma,
  ): Promise<void> {
    if (productIds.length === 0) return;
    await client.catalogProduct.updateMany({
      where: { tenantId, id: { in: productIds } },
      data: { pricingRuleId: ruleId },
    });
  }
}
