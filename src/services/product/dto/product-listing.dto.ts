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
