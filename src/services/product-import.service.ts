import { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

export class ProductImportService {
  /**
   * Import or sync a product from a supplier payload into the catalog.
   * Handles field naming for CJ Dropshipping, Printful, and generic suppliers.
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

    // --- Normalise fields across CJ, Printful, and generic suppliers ---
    // CJ: pid, productNameEn, sellPrice, productDescription
    // Printful: id, name, retail_price, description
    const externalId = String(externalData.pid || externalData.id || externalData.externalId || '');

    const title = String(
      externalData.productNameEn || // CJ
        externalData.name || // Printful / generic
        externalData.title ||
        'Imported Product',
    );

    const description = String(
      externalData.productDescription || // CJ
        externalData.description || // Printful / generic
        'Imported product from supplier',
    );

    const thumbnailUrl =
      String(
        externalData.productImage || // CJ
          externalData.thumbnail_url || // Printful
          externalData.thumbnailUrl ||
          '',
      ) || undefined;

    const costPrice = Number(
      externalData.sellPrice || // CJ
        externalData.retail_price || // Printful
        externalData.costPrice ||
        10.0,
    );

    const slug = title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .slice(0, 200);

    const rawJson = externalData as unknown as Prisma.InputJsonValue;

    const importedProduct = await prisma.$transaction(async (tx) => {
      // 1. Create or Update Catalog Product
      const product = await tx.catalogProduct.upsert({
        where: { tenantId_slug: { tenantId, slug } },
        update: {
          title,
          description,
          thumbnailUrl: thumbnailUrl || undefined,
          status: ProductStatus.PUBLISHED,
        },
        create: {
          tenantId,
          title,
          slug,
          description,
          thumbnailUrl: thumbnailUrl || undefined,
          status: ProductStatus.PUBLISHED,
        },
      });

      // 2. Link Supplier Product record (keeps the raw data + cost price)
      await tx.supplierProduct.upsert({
        where: {
          supplierId_externalId: {
            supplierId: dbSupplier.id,
            externalId,
          },
        },
        update: {
          productId: product.id,
          title,
          description,
          thumbnailUrl: thumbnailUrl || undefined,
          costPrice,
          rawData: rawJson,
          lastSyncedAt: new Date(),
        },
        create: {
          supplierId: dbSupplier.id,
          productId: product.id,
          externalId,
          title,
          description,
          thumbnailUrl: thumbnailUrl || undefined,
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
