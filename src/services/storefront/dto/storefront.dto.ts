/**
 * Storefront DTOs — the stable, typed API contracts.
 * Never expose raw Prisma entities directly from controllers.
 */

/** Shape of a product as returned from the Prisma include used in section queries. */
export interface StorefrontRawVariant {
  id: string;
  price: number;
  sku: string | null;
}

export interface StorefrontRawMedia {
  mediaUrl?: string;
  fileUrl?: string;
}

export interface StorefrontRawProduct {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl?: string | null;
  price?: number | null;
  compareAtPrice?: number | null;
  featured?: boolean;
  status?: string;
  deletedAt?: Date | null;
  categoryId?: string | null;
  createdAt?: Date;
  media?: StorefrontRawMedia[];
  variants?: StorefrontRawVariant[];
}

export interface StorefrontRawPinnedItem {
  productId: string;
  product: StorefrontRawProduct;
  position: number;
}

export interface StorefrontRawCollectionItem {
  product: StorefrontRawProduct;
  productVariant?: StorefrontRawVariant | null;
  position: number;
}

export interface StorefrontRawCollection {
  id: string;
  items: StorefrontRawCollectionItem[];
}

/** The raw section shape coming from the Prisma repository include. */
export interface StorefrontRawSection {
  id: string;
  tenantId: string;
  title: string;
  slug: string;
  strategy: string;
  sortOrder: number;
  maxItems: number;
  cacheMinutes?: number | null;
  isEnabled: boolean;
  contextType?: string | null;
  contextId?: string | null;
  pinnedItems: StorefrontRawPinnedItem[];
  collection?: StorefrontRawCollection | null;
  [key: string]: unknown;
}

export interface StorefrontProductDto {
  id: string;
  title: string;
  slug: string;
  thumbnailUrl: string | null;
  price: number | null;
  compareAtPrice: number | null;
  variants: { id: string; price: number; sku: string | null }[];
}

export interface StorefrontSectionResult {
  id: string;
  title: string;
  slug: string;
  strategy: string;
  page: string;
  sortOrder: number;
  maxItems: number;
  products: StorefrontProductDto[];
  metadata: {
    /** How many products were found before the maxItems limit was applied. */
    totalFound: number;
    /** ISO timestamp when these products were last resolved (used for cache debugging). */
    resolvedAt: string;
    /** Which strategy actually populated this section. */
    strategy: string;
  };
}

export interface StorefrontPageResult {
  id: string;
  title: string;
  slug: string;
  pageType: string;
  seoTitle: string | null;
  seoDescription: string | null;
  layout: string | null;
  sections: StorefrontSectionResult[];
}
