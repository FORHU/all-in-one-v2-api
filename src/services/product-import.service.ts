import { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

export class ProductImportService {
  /**
   * Import or sync a product from a supplier payload into the catalog.
   */
  static async importProduct(
    tenantId: string,
    supplierName: string,
    externalData: Record<string, unknown>,
  ) {
    const dbSupplier = await prisma.supplierPartner.findUnique({
      where: { name: supplierName },
    });

    if (!dbSupplier) {
      throw new Error(`Supplier ${supplierName} not found`);
    }

    const externalId = String(externalData.pid || externalData.externalId || '');
    const title = String(externalData.productNameEn || externalData.title || 'Imported Product');

    const costPrice = Number(externalData.costPrice) || 10.0;
    const description = String(externalData.description || 'Imported product from supplier');
    const rawJson = externalData as unknown as Prisma.InputJsonValue;

    const importedProduct = await prisma.$transaction(async (tx) => {
      // 1. Create or Update Catalog Product
      const product = await tx.catalogProduct.upsert({
        where: {
          tenantId_slug: {
            tenantId,
            slug: title
              .toLowerCase()
              .replace(/[^\w\s-]/g, '')
              .replace(/[\s_-]+/g, '-'),
          },
        },
        update: {
          title,
          description,
          status: ProductStatus.PUBLISHED,
        },
        create: {
          tenantId,
          title,
          slug: title
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-'),
          description,
          status: ProductStatus.PUBLISHED,
        },
      });

      // 2. Link Supplier Product
      await tx.supplierProduct.upsert({
        where: {
          supplierId_externalId: {
            supplierId: dbSupplier.id,
            externalId,
          },
        },
        update: {
          productId: product.id,
          costPrice,
          rawData: rawJson,
          lastSyncedAt: new Date(),
        },
        create: {
          supplierId: dbSupplier.id,
          productId: product.id,
          externalId,
          costPrice,
          rawData: rawJson,
          lastSyncedAt: new Date(),
        },
      });

      return product;
    });

    logger.info(`Imported product ${importedProduct.id} from supplier ${supplierName}`);
    return importedProduct;
  }
}
