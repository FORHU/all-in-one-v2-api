import { Prisma, AttributeType } from '@prisma/client';
import { prisma } from '../../utils/prisma';

type PrismaClientOrTx = typeof prisma | Prisma.TransactionClient;

function capitalize(value: string): string {
  return value.length ? value[0].toUpperCase() + value.slice(1) : value;
}

export default class AttributeRepository {
  /** Find all attributes for a tenant, including value options */
  static async findAll(tenantId: string) {
    return prisma.catalogAttribute.findMany({
      where: { tenantId },
      include: {
        values: {
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /** Find a specific attribute by ID */
  static async findById(tenantId: string, id: string) {
    return prisma.catalogAttribute.findFirst({
      where: { id, tenantId },
      include: {
        values: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  /** Find a specific attribute by Code (e.g. "color", "ram") */
  static async findByCode(tenantId: string, code: string) {
    return prisma.catalogAttribute.findUnique({
      where: { tenantId_code: { tenantId, code } },
      include: {
        values: {
          orderBy: { position: 'asc' },
        },
      },
    });
  }

  /** Create a new attribute definition with optional values */
  static async create(
    tenantId: string,
    data: {
      name: string;
      code: string;
      type?: AttributeType;
      isFilterable?: boolean;
      isSearchable?: boolean;
      values?: { value: string; label: string; swatchColor?: string; position?: number }[];
    },
  ) {
    const { values, ...attributeData } = data;
    return prisma.catalogAttribute.create({
      data: {
        ...attributeData,
        tenant: { connect: { id: tenantId } },
        values: values
          ? {
              createMany: {
                data: values,
              },
            }
          : undefined,
      },
      include: { values: true },
    });
  }

  /** Update attribute metadata — `tenantId` scopes the write even though the service already checked ownership, same defense-in-depth idiom as ProductRepository.updateVariant. */
  static async update(
    tenantId: string,
    id: string,
    data: Prisma.CatalogAttributeUncheckedUpdateManyInput,
  ) {
    await prisma.catalogAttribute.updateMany({ where: { id, tenantId }, data });
    return this.findById(tenantId, id);
  }

  /** Delete attribute and associated values */
  static async delete(tenantId: string, id: string) {
    return prisma.catalogAttribute.deleteMany({
      where: { id, tenantId },
    });
  }

  /** Add value option to an attribute */
  static async addValue(
    attributeId: string,
    data: { value: string; label: string; swatchColor?: string; position?: number },
  ) {
    return prisma.catalogAttributeValue.create({
      data: {
        attributeId,
        ...data,
      },
    });
  }

  /** Tenant-scoped lookup for a value via its parent attribute — used to verify ownership before delete, since CatalogAttributeValue carries no tenantId of its own. */
  static async findValueById(tenantId: string, valueId: string) {
    return prisma.catalogAttributeValue.findFirst({
      where: { id: valueId, attribute: { tenantId } },
    });
  }

  /** Delete an attribute value */
  static async deleteValue(valueId: string) {
    return prisma.catalogAttributeValue.delete({
      where: { id: valueId },
    });
  }

  /** Assign attribute values to a product variant — verifies the variant belongs to `tenantId` first. */
  static async assignToVariant(tenantId: string, variantId: string, valueIds: string[]) {
    await this.assertVariantOwnership(tenantId, variantId);
    const data = valueIds.map((valueId) => ({ variantId, valueId }));
    return prisma.catalogVariantAttribute.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /** Clear and re-assign attribute values for a product variant — verifies tenant ownership first. */
  static async setVariantAttributes(tenantId: string, variantId: string, valueIds: string[]) {
    await this.assertVariantOwnership(tenantId, variantId);
    return prisma.$transaction([
      prisma.catalogVariantAttribute.deleteMany({ where: { variantId } }),
      prisma.catalogVariantAttribute.createMany({
        data: valueIds.map((valueId) => ({ variantId, valueId })),
      }),
    ]);
  }

  /** Get all attributes assigned to a variant — verifies tenant ownership first. */
  static async getVariantAttributes(tenantId: string, variantId: string) {
    await this.assertVariantOwnership(tenantId, variantId);
    return prisma.catalogVariantAttribute.findMany({
      where: { variantId },
      include: {
        value: {
          include: {
            attribute: true,
          },
        },
      },
    });
  }

  private static async assertVariantOwnership(tenantId: string, variantId: string) {
    const variant = await prisma.catalogProductVariant.findFirst({
      where: { id: variantId, tenantId },
      select: { id: true },
    });
    if (!variant) throw new Error(`Variant ${variantId} not found for this tenant`);
  }

  /**
   * Upserts a CatalogAttribute + CatalogAttributeValue for each `{code, value}`
   * pair in `attrs` (e.g. `{ color: "red", size: "XL" }`) and replaces the
   * variant's CatalogVariantAttribute links with the result. This is what
   * every storefront facet/filter query actually reads from — unlike the raw
   * JSON `attributes` column callers may also write as an audit trail.
   * Accepts an injectable Prisma client so it can run inside a caller's own
   * transaction (e.g. product import).
   *
   * `cache` is optional and keyed on `code::value` — callers upserting many
   * variants in one transaction (e.g. product import, where the same
   * color/size pairs repeat across dozens of variants) can pass a shared
   * `Map` so each distinct pair is only upserted once instead of once per
   * variant. Every extra round trip here adds to how long that transaction's
   * DB connection stays open, which matters over a network link to a remote
   * DB — cutting redundant upserts is what keeps a 30-variant import from
   * running long enough to risk the connection dropping mid-transaction.
   */
  static async upsertVariantAttributesFromLabels(
    client: PrismaClientOrTx,
    tenantId: string,
    variantId: string,
    attrs: Record<string, string>,
    cache?: Map<string, string>,
  ) {
    const valueIds: string[] = [];

    for (const [rawCode, rawValue] of Object.entries(attrs)) {
      const code = rawCode.trim().toLowerCase();
      const value = rawValue.trim();
      if (!code || !value) continue;

      const cacheKey = `${code}::${value}`;
      const cached = cache?.get(cacheKey);
      if (cached) {
        valueIds.push(cached);
        continue;
      }

      const attribute = await client.catalogAttribute.upsert({
        where: { tenantId_code: { tenantId, code } },
        update: {},
        create: {
          tenantId,
          code,
          name: capitalize(code),
          type: AttributeType.SELECT,
          isFilterable: true,
        },
      });

      const attributeValue = await client.catalogAttributeValue.upsert({
        where: { attributeId_value: { attributeId: attribute.id, value } },
        update: {},
        create: { attributeId: attribute.id, value, label: capitalize(value) },
      });

      cache?.set(cacheKey, attributeValue.id);
      valueIds.push(attributeValue.id);
    }

    await client.catalogVariantAttribute.deleteMany({ where: { variantId } });
    if (valueIds.length > 0) {
      await client.catalogVariantAttribute.createMany({
        data: valueIds.map((valueId) => ({ variantId, valueId })),
        skipDuplicates: true,
      });
    }
  }
}
