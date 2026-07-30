import { ProductStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

export class ProductImportService {
  /**
   * Import or sync a product from a supplier payload into the catalog.
   */
  static async importProduct(tenantId: string, supplierName: string, externalData: any) {
    const dbSupplier = await prisma.supplierPartner.findUnique({
      where: { name: supplierName },
    });

    if (!dbSupplier) {
      throw new Error(`Supplier ${supplierName} not found`);
    }

    const externalId = externalData.pid || externalData.externalId;
    const title = externalData.productNameEn || externalData.title;

    const existing = await prisma.supplierProduct.findUnique({
      where: {
        supplierId_externalId: {
          supplierId: dbSupplier.id,
          externalId,
        },
      },
    });

    const costPrice = externalData.costPrice || 10.0;
    const sellingPrice = externalData.sellingPrice || costPrice * 1.5;

    const importedProduct = await prisma.$transaction(async (tx) => {
      // 1. Create or Update Catalog Product
      const product = await tx.catalogProduct.upsert({
        where: {
          tenantId_slug: {
            tenantId,
            slug: title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-'),
          },
        },
        update: {
          title,
          description: externalData.description || 'Imported product from supplier',
          status: ProductStatus.PUBLISHED,
        },
        create: {
          tenantId,
          title,
          slug: title.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_-]+/g, '-'),
          description: externalData.description || 'Imported product from supplier',
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
          rawData: externalData,
          lastSyncedAt: new Date(),
        },
        create: {
          supplierId: dbSupplier.id,
          productId: product.id,
          externalId,
          costPrice,
          rawData: externalData,
          lastSyncedAt: new Date(),
        },
      });

      return product;
    });

    logger.info(`Imported product ${importedProduct.id} from supplier ${supplierName}`);
    return importedProduct;
  }
}
