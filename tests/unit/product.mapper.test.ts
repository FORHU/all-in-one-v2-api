import { Prisma } from '@prisma/client';
import { mapProductToDetailDto } from '../../src/modules/catalog/product/mapper/product.mapper';
import type { ProductDetailRow } from '../../src/modules/catalog/product.repository';

const colorAttr = (value: string) => ({
  value: { value, label: value, swatchColor: null, attribute: { code: 'color' } },
});

const variant = (color: string, price: number, compareAtPrice: number | null, stock: number) => ({
  price: new Prisma.Decimal(price),
  compareAtPrice: compareAtPrice === null ? null : new Prisma.Decimal(compareAtPrice),
  variantAttributes: [colorAttr(color)],
  inventoryStocks: [],
  supplierVariants: [{ stock }],
});

// Only the fields mapProductToDetailDto reads.
const product = {
  id: 'p1',
  slug: 'razor',
  title: 'Razor',
  brand: null,
  thumbnailUrl: 'https://cf.cjdropshipping.com/a.jpg',
  description: null,
  price: new Prisma.Decimal(3.04),
  salePrice: null,
  compareAtPrice: null,
  categoryId: 'c1',
  category: { name: 'Smart Home', slug: 'smart-home' },
  createdAt: new Date('2026-10-19T00:00:00Z'),
  media: [],
  variants: [variant('Knife head', 3.04, null, 40000), variant('EU plug', 15.56, 19.99, 0)],
} as unknown as ProductDetailRow;

describe('mapProductToDetailDto — variants', () => {
  it("includes each variant's own selling price alongside its stock", () => {
    const dto = mapProductToDetailDto(product);

    expect(dto.price).toBe(3.04);
    expect(dto.variants).toEqual([
      { color: 'Knife head', size: null, stock: 40000, price: 3.04, compareAtPrice: null },
      { color: 'EU plug', size: null, stock: 0, price: 15.56, compareAtPrice: 19.99 },
    ]);
  });
});
