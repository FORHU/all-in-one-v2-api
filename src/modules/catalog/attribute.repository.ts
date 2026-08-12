import { Prisma, AttributeType } from '@prisma/client';
import { prisma } from '../../utils/prisma';

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

  /** Update attribute metadata */
  static async update(tenantId: string, id: string, data: Prisma.CatalogAttributeUpdateInput) {
    return prisma.catalogAttribute.update({
      where: { id },
      data,
      include: { values: true },
    });
  }

  /** Delete attribute and associated values */
  static async delete(tenantId: string, id: string) {
    return prisma.catalogAttribute.delete({
      where: { id },
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

  /** Delete an attribute value */
  static async deleteValue(valueId: string) {
    return prisma.catalogAttributeValue.delete({
      where: { id: valueId },
    });
  }

  /** Assign attribute values to a product variant */
  static async assignToVariant(variantId: string, valueIds: string[]) {
    const data = valueIds.map((valueId) => ({ variantId, valueId }));
    return prisma.catalogVariantAttribute.createMany({
      data,
      skipDuplicates: true,
    });
  }

  /** Clear and re-assign attribute values for a product variant */
  static async setVariantAttributes(variantId: string, valueIds: string[]) {
    return prisma.$transaction([
      prisma.catalogVariantAttribute.deleteMany({ where: { variantId } }),
      prisma.catalogVariantAttribute.createMany({
        data: valueIds.map((valueId) => ({ variantId, valueId })),
      }),
    ]);
  }

  /** Get all attributes assigned to a variant */
  static async getVariantAttributes(variantId: string) {
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
}
