import { ElectronicsCatalogService } from '../../src/modules/electronics/electronics-catalog.service';
import ElectronicsCatalogRepository from '../../src/modules/electronics/electronics-catalog.repository';
import ProductRepository from '../../src/modules/catalog/product.repository';
import { mapProductToListingDto } from '../../src/modules/catalog/product/mapper/product.mapper';

jest.mock('../../src/utils/async-context', () => ({
  requireTenantId: jest.fn(() => 'tenant-elec'),
}));
jest.mock('../../src/modules/electronics/electronics-catalog.repository', () => ({
  __esModule: true,
  default: { findPage: jest.fn(), countByCategory: jest.fn(), findCategories: jest.fn() },
}));
jest.mock('../../src/modules/catalog/product.repository', () => ({
  __esModule: true,
  default: { getRatingsForProducts: jest.fn() },
}));
jest.mock('../../src/modules/catalog/product/mapper/product.mapper', () => ({
  mapProductToListingDto: jest.fn((p: { id: string }, rating?: { rating: number }) => ({
    id: p.id,
    rating: rating?.rating ?? 0,
  })),
}));

const repo = ElectronicsCatalogRepository as unknown as {
  findPage: jest.Mock;
  countByCategory: jest.Mock;
  findCategories: jest.Mock;
};

// audio (root) > headphones (child) > earbuds (grandchild); wearables (root).
const CATEGORIES = [
  { id: 'audio', slug: 'audio', name: 'Audio & Sound', parentId: null, sortOrder: 0 },
  { id: 'headphones', slug: 'headphones', name: 'Headphones', parentId: 'audio', sortOrder: 0 },
  { id: 'earbuds', slug: 'earbuds', name: 'Earbuds', parentId: 'headphones', sortOrder: 0 },
  { id: 'wear', slug: 'wearable-tech', name: 'Wearable Tech', parentId: null, sortOrder: 1 },
];

const query = (overrides = {}) => ({ sort: 'newest' as const, page: 2, limit: 12, ...overrides });

beforeEach(() => {
  jest.clearAllMocks();
  repo.findCategories.mockResolvedValue(CATEGORIES);
  repo.findPage.mockResolvedValue({
    items: [{ id: 'p1' }, { id: 'p2' }],
    total: 26,
    page: 2,
    limit: 12,
    totalPages: 3,
  });
  repo.countByCategory.mockResolvedValue(
    new Map<string | null, number>([
      ['audio', 2],
      ['earbuds', 3],
      ['wear', 5],
      [null, 1],
    ]),
  );
  (ProductRepository.getRatingsForProducts as jest.Mock).mockResolvedValue(
    new Map([['p1', { rating: 4.5, reviewCount: 2 }]]),
  );
});

describe('ElectronicsCatalogService.listProducts', () => {
  it('returns the page envelope with mapped, rated items', async () => {
    const result = await ElectronicsCatalogService.listProducts(query());

    expect(result).toMatchObject({ total: 26, page: 2, limit: 12, totalPages: 3 });
    expect(result.items).toEqual([
      { id: 'p1', rating: 4.5 },
      { id: 'p2', rating: 0 },
    ]);
    expect(mapProductToListingDto).toHaveBeenCalledTimes(2);
  });

  it('passes sort, price and paging to the repository, with no category filter by default', async () => {
    await ElectronicsCatalogService.listProducts(
      query({ sort: 'name-asc', priceMin: 10, priceMax: 49.99 }),
    );

    expect(repo.findPage).toHaveBeenCalledWith('tenant-elec', {
      categoryIds: undefined,
      priceMin: 10,
      priceMax: 49.99,
      sort: 'name-asc',
      page: 2,
      limit: 12,
    });
    expect(repo.countByCategory).toHaveBeenCalledWith('tenant-elec', {
      priceMin: 10,
      priceMax: 49.99,
    });
  });

  it('includes every descendant of the selected category', async () => {
    await ElectronicsCatalogService.listProducts(query({ categorySlug: 'headphones' }));

    expect(repo.findPage.mock.calls[0][1].categoryIds.sort()).toEqual(['earbuds', 'headphones']);
  });

  it('narrows an unknown category slug to zero results', async () => {
    await ElectronicsCatalogService.listProducts(query({ categorySlug: 'no-such-category' }));

    expect(repo.findPage.mock.calls[0][1].categoryIds).toEqual([]);
  });

  it('rolls subcategory counts up into their root category, and totals every product', async () => {
    const result = await ElectronicsCatalogService.listProducts(query());

    expect(result.categories).toEqual([
      { id: 'audio', slug: 'audio', name: 'Audio & Sound', count: 5 },
      { id: 'wear', slug: 'wearable-tech', name: 'Wearable Tech', count: 5 },
    ]);
    expect(result.allCount).toBe(11);
  });
});
