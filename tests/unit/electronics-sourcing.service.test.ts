import { ElectronicsSourcingService } from '../../src/modules/electronics/electronics-sourcing.service';
import { ELECTRONICS_CJ_SOURCES } from '../../src/modules/electronics/electronics.config';
import { ProductImportService } from '../../src/modules/catalog/product-import.service';
import TenantRepository from '../../src/modules/tenant/tenant.repository';
import CategoryRepository from '../../src/modules/catalog/category.repository';
import SupplierRepository from '../../src/modules/supplier/supplier.repository';
import { supplierRegistry } from '../../src/suppliers/supplier.registry';

jest.mock('../../src/modules/tenant/tenant.repository', () => ({
  __esModule: true,
  default: { findBySlug: jest.fn() },
}));
jest.mock('../../src/modules/catalog/category.repository', () => ({
  __esModule: true,
  default: { findBySlug: jest.fn() },
}));
jest.mock('../../src/modules/supplier/supplier.repository', () => ({
  __esModule: true,
  default: { findImportedExternalIdsForTenant: jest.fn() },
}));
jest.mock('../../src/modules/catalog/product-import.service', () => ({
  ProductImportService: { importProduct: jest.fn() },
}));
jest.mock('../../src/suppliers/supplier.registry', () => ({
  supplierRegistry: { get: jest.fn() },
}));

const adapter = {
  searchProducts: jest.fn(),
  normalizeSearchResult: jest.fn((raw: unknown) => raw as Record<string, unknown>),
  getProduct: jest.fn(),
  getCategories: jest.fn(),
};

const tenants = TenantRepository as unknown as { findBySlug: jest.Mock };
const categories = CategoryRepository as unknown as { findBySlug: jest.Mock };
const suppliers = SupplierRepository as unknown as { findImportedExternalIdsForTenant: jest.Mock };
const importProduct = ProductImportService.importProduct as jest.Mock;

const SPEAKERS = ELECTRONICS_CJ_SOURCES.audio.cjCategoryIds[0];

beforeEach(() => {
  jest.clearAllMocks();
  (supplierRegistry.get as jest.Mock).mockReturnValue(adapter);
  tenants.findBySlug.mockResolvedValue({
    id: 'tenant-elec',
    slug: 'electronics',
    status: 'ACTIVE',
  });
  categories.findBySlug.mockResolvedValue({ id: 'cat-audio', slug: 'audio' });
  suppliers.findImportedExternalIdsForTenant.mockResolvedValue(new Map([['cj-2', 'prod-2']]));
  adapter.searchProducts.mockResolvedValue({
    items: [
      { id: 'cj-1', nameEn: 'Speaker A' },
      { id: 'cj-2', nameEn: 'Speaker B' },
    ],
    total: 2,
  });
  importProduct.mockResolvedValue({ id: 'prod-new', title: 'Speaker A', price: 20 });
});

describe('ElectronicsSourcingService.searchCj', () => {
  it("browses the category's first mapped CJ category with no keyword", async () => {
    const result = await ElectronicsSourcingService.searchCj({
      categorySlug: 'audio',
      page: 1,
      limit: 20,
    });

    expect(adapter.searchProducts).toHaveBeenCalledWith('', 1, 20, SPEAKERS);
    expect(result.source).toEqual({ categorySlug: 'audio', cjCategoryId: SPEAKERS, keyword: null });
    expect(result.total).toBe(2);
  });

  it('flags products the electronics catalog already has', async () => {
    const result = await ElectronicsSourcingService.searchCj({
      categorySlug: 'audio',
      page: 1,
      limit: 20,
    });

    expect(suppliers.findImportedExternalIdsForTenant).toHaveBeenCalledWith(
      'cj-dropshipping',
      ['cj-1', 'cj-2'],
      'tenant-elec',
    );
    expect(result.items.map((i) => [i.id, i.alreadyImported, i.catalogProductId])).toEqual([
      ['cj-1', false, null],
      ['cj-2', true, 'prod-2'],
    ]);
  });

  it("rejects a CJ category id that isn't mapped to the DigitFriend category", async () => {
    await expect(
      ElectronicsSourcingService.searchCj({
        categorySlug: 'audio',
        cjCategoryId: ELECTRONICS_CJ_SOURCES['wearable-tech'].cjCategoryIds[0],
        page: 1,
        limit: 20,
      }),
    ).rejects.toMatchObject({ status: 400 });
    expect(adapter.searchProducts).not.toHaveBeenCalled();
  });

  it('falls back to keyword search for a category CJ has no category for', async () => {
    await ElectronicsSourcingService.searchCj({
      categorySlug: 'computer-peripherals',
      page: 1,
      limit: 10,
    });

    expect(adapter.searchProducts).toHaveBeenCalledWith(
      ELECTRONICS_CJ_SOURCES['computer-peripherals'].keywords[0],
      1,
      10,
      undefined,
    );
  });

  it('fails when the electronics tenant is not active', async () => {
    tenants.findBySlug.mockResolvedValue({ id: 'tenant-elec', status: 'SUSPENDED' });

    await expect(
      ElectronicsSourcingService.searchCj({ categorySlug: 'audio', page: 1, limit: 20 }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('ElectronicsSourcingService.importFromCj', () => {
  it('imports an electronics CJ product into the electronics tenant and category', async () => {
    adapter.getProduct.mockResolvedValue({ pid: 'cj-1', categoryId: SPEAKERS });

    const product = await ElectronicsSourcingService.importFromCj('cj-1', 'audio');

    expect(tenants.findBySlug).toHaveBeenCalledWith('electronics');
    expect(categories.findBySlug).toHaveBeenCalledWith('tenant-elec', 'audio');
    expect(importProduct).toHaveBeenCalledWith(
      'tenant-elec',
      'cj-dropshipping',
      expect.objectContaining({ pid: 'cj-1' }),
      'cat-audio',
    );
    expect(product).toMatchObject({ id: 'prod-new' });
  });

  it('rejects a CJ product from outside the electronics categories', async () => {
    adapter.getProduct.mockResolvedValue({
      pid: 'cj-ring',
      categoryId: 'not-an-electronics-id',
      categoryName: 'Rings',
    });

    await expect(ElectronicsSourcingService.importFromCj('cj-ring', 'audio')).rejects.toMatchObject(
      {
        status: 422,
      },
    );
    expect(importProduct).not.toHaveBeenCalled();
  });

  it('skips the CJ category check for a keyword-sourced category', async () => {
    categories.findBySlug.mockResolvedValue({ id: 'cat-peri', slug: 'computer-peripherals' });
    adapter.getProduct.mockResolvedValue({ pid: 'cj-kb', categoryId: 'some-office-category' });

    await ElectronicsSourcingService.importFromCj('cj-kb', 'computer-peripherals');

    expect(importProduct).toHaveBeenCalledWith(
      'tenant-elec',
      'cj-dropshipping',
      expect.objectContaining({ pid: 'cj-kb' }),
      'cat-peri',
    );
  });

  it('404s when the product no longer exists on CJ', async () => {
    adapter.getProduct.mockResolvedValue(null);

    await expect(ElectronicsSourcingService.importFromCj('gone', 'audio')).rejects.toMatchObject({
      status: 404,
    });
    expect(importProduct).not.toHaveBeenCalled();
  });

  it("404s when the electronics tenant doesn't have the category", async () => {
    categories.findBySlug.mockResolvedValue(null);

    await expect(ElectronicsSourcingService.importFromCj('cj-1', 'audio')).rejects.toMatchObject({
      status: 404,
    });
    expect(adapter.getProduct).not.toHaveBeenCalled();
  });
});
