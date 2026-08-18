import { ProductStatus, Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import logger from '../../utils/logger';
import { calculateVariantPrice } from '../../utils/pricing.util';
import AttributeRepository from './attribute.repository';
import InventoryRepository from '../inventory/inventory.repository';
import PricingRuleRepository from './pricing-rule.repository';
import CategoryRepository from './category.repository';
import { supplierRegistry } from '../../suppliers/supplier.registry';
import { throwResponse } from '../../utils/throw-response';

// Neither CJ nor Printful's catalog (pre-fulfillment) payloads carry a real
// per-variant stock count — CJ's own getInventory() falls back to this same
// placeholder. Dropship/print-on-demand suppliers fulfill on order, so this
// just keeps freshly imported products from showing "out of stock" by
// default; admins can correct it via the Inventory feature once real
// availability is known.
const DEFAULT_IMPORT_STOCK = 999;

type NormalizedVariant = {
  externalId: string;
  title: string;
  sku?: string;
  // `undefined` = supplier didn't provide a price at all (falls back to the
  // product's lowest variant price below); a real `0` must survive as `0`,
  // not be treated the same as "missing".
  price: number | undefined;
  attributes?: Record<string, string>;
  images: string[];
};

/** Preserves "missing" as `undefined` instead of collapsing it into `0` like `Number(x) || 0` would. */
function toOptionalNumber(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  const num = Number(raw);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * Supplier's own category label, read straight off the raw payload —
 * CJ's `categoryName`, Printful's `product.type_name`. Shared by both
 * normalizers below rather than duplicated inline in each.
 */
function extractSupplierCategoryName(
  supplierName: string,
  data: Record<string, unknown>,
): string | undefined {
  if (supplierName === 'cj-dropshipping') {
    return typeof data.categoryName === 'string' && data.categoryName.trim()
      ? data.categoryName.trim()
      : undefined;
  }
  if (supplierName === 'printful') {
    const product = (data.product ?? {}) as Record<string, unknown>;
    return typeof product.type_name === 'string' && product.type_name.trim()
      ? product.type_name.trim()
      : undefined;
  }
  return undefined;
}

type NormalizedProduct = {
  externalId: string;
  title: string;
  description: string;
  images: string[];
  variants: NormalizedVariant[];
  // Supplier's own category label (CJ: categoryName, Printful: type_name) —
  // mapped onto a tenant CatalogCategory below. `undefined` when the
  // supplier payload doesn't carry one (e.g. the generic normalizer).
  categoryName?: string;
};

/**
 * CJ's `variantKey` is a single "-"-joined string (e.g. "Black-S") whose part
 * order matches `productKeyEn` (e.g. "Color-Size"). Splits positionally when
 * the two line up; falls back to a generic bucket rather than guessing wrong.
 */
function splitCjVariantKey(
  keyOrder: string | undefined,
  variantKey: string | undefined,
): Record<string, string> | undefined {
  if (!variantKey) return undefined;
  const parts = variantKey
    .split('-')
    .map((p) => p.trim())
    .filter(Boolean);
  const labels = keyOrder
    ?.split('-')
    .map((l) => l.trim().toLowerCase())
    .filter(Boolean);

  if (labels && labels.length === parts.length) {
    return Object.fromEntries(labels.map((label, i) => [label, parts[i]]));
  }
  return { variant: variantKey };
}

function normalizeCjProduct(data: Record<string, unknown>): NormalizedProduct {
  const externalId = String(data.pid || '');
  const title = String(data.productNameEn || 'Imported Product');
  const description = String(data.description || 'Imported product from supplier');
  const bigImage = typeof data.bigImage === 'string' ? data.bigImage : undefined;
  const imageSet = Array.isArray(data.productImageSet) ? (data.productImageSet as string[]) : [];
  const productKeyEn = typeof data.productKeyEn === 'string' ? data.productKeyEn : undefined;
  const categoryName = extractSupplierCategoryName('cj-dropshipping', data);

  const rawVariants = Array.isArray(data.variants)
    ? (data.variants as Record<string, unknown>[])
    : [];

  const variants: NormalizedVariant[] = rawVariants
    .map((v) => {
      const variantKey = typeof v.variantKey === 'string' ? v.variantKey : undefined;
      return {
        externalId: String(v.vid || ''),
        title: String(v.variantNameEn || variantKey || title),
        sku: typeof v.variantSku === 'string' ? v.variantSku : undefined,
        price: toOptionalNumber(v.variantSellPrice),
        attributes: splitCjVariantKey(productKeyEn, variantKey),
        images: typeof v.variantImage === 'string' ? [v.variantImage] : [],
      };
    })
    .filter((v) => v.externalId);

  const images = Array.from(
    new Set(
      [bigImage, ...imageSet, ...variants.flatMap((v) => v.images)].filter((v): v is string =>
        Boolean(v),
      ),
    ),
  );

  return { externalId, title, description, images, variants, categoryName };
}

function normalizePrintfulProduct(data: Record<string, unknown>): NormalizedProduct {
  const product = (data.product ?? {}) as Record<string, unknown>;
  const externalId = String(product.id ?? data.id ?? '');
  const title = String(product.title || 'Imported Product');
  const description = String(product.description || 'Imported product from supplier');
  const mainImage = typeof product.image === 'string' ? product.image : undefined;
  const categoryName = extractSupplierCategoryName('printful', data);

  const rawVariants = Array.isArray(data.variants)
    ? (data.variants as Record<string, unknown>[])
    : [];

  const variants: NormalizedVariant[] = rawVariants
    .map((v) => {
      const color = typeof v.color === 'string' && v.color ? v.color : undefined;
      const size = typeof v.size === 'string' && v.size ? v.size : undefined;
      return {
        externalId: String(v.id ?? ''),
        title: String(v.name || [color, size].filter(Boolean).join(' / ') || title),
        // Printful's catalog (pre-fulfillment) variants don't carry a merchant SKU.
        sku: undefined,
        price: toOptionalNumber(v.price),
        attributes:
          color || size ? { ...(color ? { color } : {}), ...(size ? { size } : {}) } : undefined,
        images: typeof v.image === 'string' ? [v.image] : [],
      };
    })
    .filter((v) => v.externalId);

  const images = Array.from(
    new Set(
      [mainImage, ...variants.flatMap((v) => v.images)].filter((v): v is string => Boolean(v)),
    ),
  );

  return { externalId, title, description, images, variants, categoryName };
}

/** Fallback for suppliers with no dedicated normalizer — one flat, single-variant product. */
function normalizeGenericProduct(data: Record<string, unknown>): NormalizedProduct {
  const externalId = String(data.id || data.externalId || '');
  const title = String(data.name || data.title || 'Imported Product');
  const description = String(data.description || 'Imported product from supplier');
  const image =
    typeof data.thumbnail_url === 'string'
      ? data.thumbnail_url
      : typeof data.thumbnailUrl === 'string'
        ? data.thumbnailUrl
        : undefined;
  const price = Number(data.retail_price || data.costPrice || 10.0);

  return {
    externalId,
    title,
    description,
    images: image ? [image] : [],
    variants: [{ externalId, title, price, images: image ? [image] : [] }],
  };
}

export class ProductImportService {
  /**
   * Import or sync a product from a supplier payload into the catalog —
   * creates the parent CatalogProduct plus one real, sellable
   * CatalogProductVariant per supplier variant (color/size/etc), each linked
   * back through a SupplierVariant row so re-importing updates in place
   * instead of duplicating.
   */
  static async importProduct(
    tenantId: string,
    supplierName: string,
    externalData: Record<string, unknown>,
    // Admin's explicit category choice from the import UI. `undefined` (param
    // omitted) preserves today's auto-create-from-supplier-label behavior —
    // this is also what the unattended resync consumer relies on, since
    // there's no admin present there to make a choice. `null` means the
    // admin explicitly chose "No category".
    categoryId?: string | null,
  ) {
    const dbSupplier = await prisma.supplierPartner.findUnique({
      where: { name: supplierName },
    });

    if (!dbSupplier) {
      throw new Error(`Supplier ${supplierName} not found`);
    }

    // Brand-new products pick up the tenant's default markup rule (if any)
    // automatically — existing products are never touched here (an admin's
    // explicit rule choice, or deliberate "no rule", survives every resync).
    // Retroactively sweeping already-imported products onto a new default is
    // what PricingRuleService.applyToAll is for.
    const defaultPricingRule = await PricingRuleRepository.findDefault(tenantId);

    const normalized =
      supplierName === 'cj-dropshipping'
        ? normalizeCjProduct(externalData)
        : supplierName === 'printful'
          ? normalizePrintfulProduct(externalData)
          : normalizeGenericProduct(externalData);

    if (!normalized.externalId) {
      throw new Error(`Supplier payload from ${supplierName} is missing an external product id`);
    }

    const slug = normalized.title
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_-]+/g, '-')
      .slice(0, 200);

    const rawJson = externalData as unknown as Prisma.InputJsonValue;
    const variantPrices = normalized.variants
      .map((v) => v.price)
      .filter((p): p is number => typeof p === 'number' && p > 0);
    const lowestPrice = variantPrices.length ? Math.min(...variantPrices) : 10.0;

    // Live stock straight from the supplier — fetched outside the DB
    // transaction below since it's a network round-trip per variant (and
    // rate-limited on CJ's side), not something that should hold a
    // transaction open. Runs on every import AND every resync (see
    // product-sync.consumer.ts), so a variant's stock always reflects the
    // supplier's current number rather than a one-time snapshot. Falls back
    // to the placeholder per-variant below if this fails or the adapter
    // doesn't report a given variant.
    const stockByExternalId = new Map<string, number>();
    try {
      const adapter = supplierRegistry.get(supplierName);
      const externalIds = normalized.variants.map((v) => v.externalId).filter(Boolean);
      const stocks = await adapter.getInventory(externalIds);
      for (const s of stocks) stockByExternalId.set(s.externalId, s.stock);
    } catch (error) {
      logger.error(
        `[ProductImportService] Failed to fetch live inventory from ${supplierName} — variants will use the default placeholder stock.`,
        error,
      );
    }

    const importedProduct = await prisma.$transaction(
      async (tx) => {
        // Three-way: an explicit categoryId (string) is the admin's real
        // choice from the import UI and is used as-is; `null` is the admin's
        // explicit "No category"; `undefined` (param omitted, e.g. the
        // unattended resync consumer) falls back to matching/creating a
        // tenant CatalogCategory from the supplier's own category label —
        // re-imports of the same product name-match onto the same category
        // (or a renamed one) rather than creating dupes.
        let category: { id: string } | null;
        if (categoryId === undefined) {
          category = normalized.categoryName
            ? await CategoryRepository.findOrCreateByName(tenantId, normalized.categoryName, tx)
            : null;
        } else if (categoryId === null) {
          category = null;
        } else {
          category = await CategoryRepository.findById(tenantId, categoryId);
          if (!category) {
            throwResponse(404, `Category '${categoryId}' not found`);
          }
        }

        const product = await tx.catalogProduct.upsert({
          where: { tenantId_slug: { tenantId, slug } },
          update: {
            title: normalized.title,
            description: normalized.description,
            thumbnailUrl: normalized.images[0],
            price: lowestPrice,
            status: ProductStatus.PUBLISHED,
            categoryId: category?.id,
          },
          create: {
            tenantId,
            title: normalized.title,
            slug,
            description: normalized.description,
            thumbnailUrl: normalized.images[0],
            price: lowestPrice,
            status: ProductStatus.PUBLISHED,
            pricingRuleId: defaultPricingRule?.id,
            categoryId: category?.id,
          },
          include: { pricingRule: true },
        });

        // Resolved once per import, not per variant — every variant seeds
        // stock at the same tenant location.
        const primaryLocation = await InventoryRepository.findPrimaryLocation(tenantId, tx);

        const supplierProduct = await tx.supplierProduct.upsert({
          where: {
            supplierId_externalId: { supplierId: dbSupplier.id, externalId: normalized.externalId },
          },
          update: {
            productId: product.id,
            title: normalized.title,
            description: normalized.description,
            thumbnailUrl: normalized.images[0],
            costPrice: lowestPrice,
            rawData: rawJson,
            lastSyncedAt: new Date(),
          },
          create: {
            supplierId: dbSupplier.id,
            productId: product.id,
            externalId: normalized.externalId,
            title: normalized.title,
            description: normalized.description,
            thumbnailUrl: normalized.images[0],
            costPrice: lowestPrice,
            rawData: rawJson,
            lastSyncedAt: new Date(),
          },
        });

        // Product-level gallery (re-synced fresh each import).
        await tx.catalogProductMedia.deleteMany({
          where: { productId: product.id, productVariantId: null },
        });
        if (normalized.images.length > 0) {
          await tx.catalogProductMedia.createMany({
            data: normalized.images.map((url, index) => ({
              productId: product.id,
              url,
              isPrimary: index === 0,
              position: index,
            })),
          });
        }

        // Shared across every variant below — CJ/Printful variants of the
        // same product are almost always the cross product of a handful of
        // colors/sizes, so without this the same {code, value} pair gets
        // upserted over and over (once per variant that shares it) inside
        // this one long-lived transaction. See the cache param's doc comment
        // on upsertVariantAttributesFromLabels.
        const attributeValueCache = new Map<string, string>();

        // One real CatalogProductVariant per supplier variant — without this,
        // the product has nothing a cart/order can reference and can't
        // actually be sold.
        for (const variant of normalized.variants) {
          const existingLink = await tx.supplierVariant.findUnique({
            where: {
              supplierProductId_externalId: {
                supplierProductId: supplierProduct.id,
                externalId: variant.externalId,
              },
            },
          });

          const cost = variant.price ?? lowestPrice;
          const liveStock = stockByExternalId.get(variant.externalId);
          const stockToSet =
            typeof liveStock === 'number' && liveStock >= 0 ? liveStock : DEFAULT_IMPORT_STOCK;
          const priceResult = calculateVariantPrice(cost, product.pricingRule);
          const variantData = {
            tenantId,
            productId: product.id,
            sku: variant.sku,
            title: variant.title,
            price: priceResult.calculatedPrice,
            baseCost: cost,
            calculatedPrice: priceResult.calculatedPrice,
            attributes: variant.attributes as Prisma.InputJsonValue | undefined,
          };

          const catalogVariant = existingLink?.productVariantId
            ? await tx.catalogProductVariant.update({
                where: { id: existingLink.productVariantId },
                data: variantData,
              })
            : await tx.catalogProductVariant.create({ data: variantData });

          // Wire parsed color/size labels into the real EAV tables — every
          // storefront facet/filter query reads from these, not from the
          // `attributes` JSON column above (which stays as a raw audit trail).
          if (variant.attributes) {
            await AttributeRepository.upsertVariantAttributesFromLabels(
              tx,
              tenantId,
              catalogVariant.id,
              variant.attributes,
              attributeValueCache,
            );
          }

          // Stock is synced from the supplier on every import AND every
          // resync (product-sync.consumer.ts routes through here too) — for
          // dropship/print-on-demand variants the supplier IS the warehouse,
          // so the number lives on SupplierVariant.stock, which is what
          // InventoryRepository.getEffectiveAvailableStock falls back to
          // when this tenant has no InventoryLocation. Falls back to
          // DEFAULT_IMPORT_STOCK only when the supplier didn't report a
          // number for this variant (adapter error, unmapped id).
          //
          // The InventoryStock write below is only for tenants that DO have
          // a location set up (first-party sellers with real warehouses) —
          // it's best-effort and never required for a dropship variant to
          // be sellable.
          if (primaryLocation) {
            await InventoryRepository.setStock(
              tenantId,
              catalogVariant.id,
              primaryLocation.id,
              stockToSet,
              undefined,
              tx,
            );
          }

          await tx.supplierVariant.upsert({
            where: {
              supplierProductId_externalId: {
                supplierProductId: supplierProduct.id,
                externalId: variant.externalId,
              },
            },
            update: {
              productVariantId: catalogVariant.id,
              costPrice: cost,
              stock: stockToSet,
              title: variant.title,
              thumbnailUrl: variant.images[0],
              attributes: variant.attributes as Prisma.InputJsonValue | undefined,
              rawData: variant as unknown as Prisma.InputJsonValue,
              lastSyncedAt: new Date(),
            },
            create: {
              supplierProductId: supplierProduct.id,
              productVariantId: catalogVariant.id,
              externalId: variant.externalId,
              costPrice: cost,
              stock: stockToSet,
              title: variant.title,
              thumbnailUrl: variant.images[0],
              attributes: variant.attributes as Prisma.InputJsonValue | undefined,
              rawData: variant as unknown as Prisma.InputJsonValue,
              lastSyncedAt: new Date(),
            },
          });

          await tx.catalogProductMedia.deleteMany({
            where: { productVariantId: catalogVariant.id },
          });
          if (variant.images.length > 0) {
            await tx.catalogProductMedia.createMany({
              data: variant.images.map((url, index) => ({
                productId: product.id,
                productVariantId: catalogVariant.id,
                url,
                isPrimary: index === 0,
                position: index,
              })),
            });
          }
        }

        return product;
      },
      // A CJ product can carry 30+ variants, each needing several sequential
      // queries on the same transaction connection — the 5s default timeout
      // isn't enough.
      { timeout: 30000 },
    );

    logger.info(
      `Imported product ${importedProduct.id} (${normalized.variants.length} variants) from supplier ${supplierName}`,
    );
    return importedProduct;
  }
}
