export interface ProductAttributeOptionDto {
  value: string;
  label: string;
  swatchColor?: string | null;
}

export interface ProductListingItemDto {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  thumbnailUrl: string | null;
  price: number | null;
  salePrice: number | null;
  compareAtPrice: number | null;
  rating: number;
  reviewCount: number;
  colors: ProductAttributeOptionDto[];
  sizes: ProductAttributeOptionDto[];
  inStock: boolean;
  categoryId: string | null;
  createdAt: Date;
}

export interface ProductVariantStockDto {
  color: string | null;
  size: string | null;
  stock: number;
}

export interface ProductDetailDto extends ProductListingItemDto {
  description: string | null;
  images: string[];
  categorySlug: string | null;
  categoryName: string | null;
  variants: ProductVariantStockDto[];
}

export interface ProductFacetsDto {
  priceMin: number | null;
  priceMax: number | null;
  brands: string[];
  colors: ProductAttributeOptionDto[];
  sizes: ProductAttributeOptionDto[];
}

export interface AdminProductVariantDto {
  id: string;
  sku: string | null;
  title: string;
  price: number;
  compareAtPrice: number | null;
  color: string | null;
  size: string | null;
  stockAvailable: number;
  thumbnailUrl: string | null;
}

export interface AdminProductListingItemDto {
  id: string;
  slug: string;
  title: string;
  brand: string | null;
  status: string;
  visibility: string;
  thumbnailUrl: string | null;
  price: number | null;
  salePrice: number | null;
  compareAtPrice: number | null;
  // Lowest supplier cost (CatalogProductVariant.baseCost) across this
  // product's variants — null when nothing was ever imported from a
  // supplier (no cost basis to show). Distinct from `price`/`calculatedPrice`,
  // which already have any pricing-rule markup applied on top of this.
  originalPrice: number | null;
  category: { id: string; name: string } | null;
  pricingRule: { id: string; name: string } | null;
  variantCount: number;
  inStock: boolean;
  // Full product-level photo gallery — `thumbnailUrl` above is just the
  // first entry, kept separately since older callers only expect a single
  // image and admin listing UIs want the whole strip.
  images: string[];
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}
