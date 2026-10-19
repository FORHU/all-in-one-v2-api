import ElectronicsCatalogRepository from '../../src/modules/electronics/electronics-catalog.repository';
import { prisma } from '../../src/utils/prisma';

jest.mock('../../src/utils/prisma', () => ({
  prisma: {
    catalogProduct: { findMany: jest.fn(), count: jest.fn(), groupBy: jest.fn() },
    catalogCategory: { findMany: jest.fn() },
  },
}));

const db = prisma as unknown as {
  catalogProduct: { findMany: jest.Mock; count: jest.Mock; groupBy: jest.Mock };
};

beforeEach(() => {
  jest.clearAllMocks();
  db.catalogProduct.findMany.mockResolvedValue([{ id: 'p13' }]);
  db.catalogProduct.count.mockResolvedValue(26);
  db.catalogProduct.groupBy.mockResolvedValue([
    { categoryId: 'audio', _count: { _all: 4 } },
    { categoryId: null, _count: { _all: 1 } },
  ]);
});

describe('ElectronicsCatalogRepository.findPage', () => {
  it('skips to the requested page and returns the standard page envelope', async () => {
    const page = await ElectronicsCatalogRepository.findPage('t1', {
      sort: 'newest',
      page: 2,
      limit: 12,
    });

    expect(db.catalogProduct.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 12, take: 12 }),
    );
    expect(page).toMatchObject({
      items: [{ id: 'p13' }],
      total: 26,
      page: 2,
      limit: 12,
      totalPages: 3,
    });
  });

  it.each([
    ['newest', { createdAt: 'desc' }],
    ['price-asc', { price: 'asc' }],
    ['price-desc', { price: 'desc' }],
    ['name-asc', { title: 'asc' }],
  ] as const)('sorts %s with an id tie-breaker for stable pages', async (sort, primary) => {
    await ElectronicsCatalogRepository.findPage('t1', { sort, page: 1, limit: 12 });

    expect(db.catalogProduct.findMany.mock.calls[0][0].orderBy).toEqual([primary, { id: 'asc' }]);
  });

  it('only lists published, non-deleted products of the tenant, within the filters', async () => {
    await ElectronicsCatalogRepository.findPage('t1', {
      categoryIds: ['audio'],
      priceMin: 50,
      priceMax: 80,
      sort: 'newest',
      page: 1,
      limit: 12,
    });

    const where = {
      tenantId: 't1',
      status: 'PUBLISHED',
      deletedAt: null,
      categoryId: { in: ['audio'] },
      price: { gte: 50, lte: 80 },
    };
    expect(db.catalogProduct.findMany.mock.calls[0][0].where).toEqual(where);
    expect(db.catalogProduct.count).toHaveBeenCalledWith({ where });
  });
});

describe('ElectronicsCatalogRepository.countByCategory', () => {
  it('groups by category under the price filter', async () => {
    const counts = await ElectronicsCatalogRepository.countByCategory('t1', { priceMax: 49.99 });

    expect(db.catalogProduct.groupBy).toHaveBeenCalledWith({
      by: ['categoryId'],
      where: { tenantId: 't1', status: 'PUBLISHED', deletedAt: null, price: { lte: 49.99 } },
      _count: { _all: true },
    });
    expect(counts).toEqual(
      new Map<string | null, number>([
        ['audio', 4],
        [null, 1],
      ]),
    );
  });
});
