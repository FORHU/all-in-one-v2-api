import { ProductStatus } from '@prisma/client';
import { supplierRegistry } from '../suppliers/supplier.registry';
import { prisma } from '../utils/prisma';
import { throwResponse } from '../utils/throw-response';
import { PricingUtil } from '../utils/pricing.util';

export class ProductImportService {
  /**
   * Imports a product from a supplier into the centralized platform database.
   * Applies the platform's commission/markup to the cost price.
   */
  static async importProductToPlatform(tenantId: string, supplierId: string, externalId: string) {
    const adapter = supplierRegistry.get(supplierId);
    if (!adapter) {
      return throwResponse(404, `Supplier ${supplierId} not found`);
    }

    // 1. Fetch full details from supplier
    const rawProduct = await adapter.getProduct(externalId);
    if (!rawProduct) {
      return throwResponse(404, `Product ${externalId} not found on ${supplierId}`);
    }

    // For the sake of this implementation, we need to extract the basic details.
    // In production, the adapter interface would enforce a `NormalizedProductDetail` type.
    // We'll do a loose extraction similar to what we did in the search service.
    const rawObj = rawProduct as Record<string, unknown>;
    const title = String(rawObj?.title || rawObj?.productNameEn || 'Imported Product');
    const description = String(rawObj?.description || '');
    const costPrice = parseFloat(String(rawObj?.sellPrice || rawObj?.price || 0));

    // Get the supplier DB record
    const dbSupplier = await prisma.supplier.findUnique({
      where: { name: supplierId },
    });

    if (!dbSupplier) {
      return throwResponse(404, `Supplier ${supplierId} is not configured in the database.`);
    }

    // Check if already imported
    const existing = await prisma.supplierProduct.findUnique({
      where: {
        supplierId_externalId: {
          supplierId: dbSupplier.id,
          externalId,
        },
      },
    });

    if (existing) {
      // SupplierProduct is unique per (supplier, externalId), so a given
      // supplier item lives in exactly one vertical.
      return throwResponse(409, `Product ${externalId} is already imported.`);
    }

    // Calculate final selling price
    const finalSellingPrice = PricingUtil.calculatePlatformPrice(costPrice);

    // 2. Save everything in a transaction
    const importedProduct = await prisma.$transaction(async (tx) => {
      // Create the platform Product
      const product = await tx.product.create({
        data: {
          tenantId,
          title,
          description,
          status: ProductStatus.PUBLISHED,
        },
      });

      // Create the SupplierProduct mapping
      const supplierProduct = await tx.supplierProduct.create({
        data: {
          supplierId: dbSupplier.id,
          productId: product.id,
          externalId,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rawData: rawProduct as any,
          costPrice,
        },
      });

      // Create a single default variant (real implementation would loop over rawProduct variants)
      const productVariant = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          title: 'Default Title',
          price: finalSellingPrice,
          stock: 999, // default
        },
      });

      // Create SupplierVariant mapping
      await tx.supplierVariant.create({
        data: {
          supplierProductId: supplierProduct.id,
          productVariantId: productVariant.id,
          externalId: externalId + '-var', // dummy mapping
          costPrice,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          rawData: rawProduct as any,
        },
      });

      return product;
    });

    return importedProduct;
  }
}
