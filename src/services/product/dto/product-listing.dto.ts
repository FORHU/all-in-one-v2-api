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

export interface ProductFacetsDto {
  priceMin: number | null;
  priceMax: number | null;
  brands: string[];
  colors: ProductAttributeOptionDto[];
  sizes: ProductAttributeOptionDto[];
}
