import { ProductImportService } from '../../src/modules/catalog/product-import.service';
import PricingRuleRepository from '../../src/modules/catalog/pricing-rule.repository';
import { supplierRegistry } from '../../src/suppliers/supplier.registry';
import { prisma } from '../../src/utils/prisma';

// Transaction client handed to importProduct's $transaction callback.
const tx = {
  catalogProduct: { findUnique: jest.fn(), upsert: jest.fn(), update: jest.fn() },
  supplierProduct: { upsert: jest.fn() },
  catalogProductMedia: { deleteMany: jest.fn(), createMany: jest.fn() },
  supplierVariant: { findUnique: jest.fn(), upsert: jest.fn() },
  catalogProductVariant: { create: jest.fn(), update: jest.fn() },
};

jest.mock('../../src/utils/prisma', () => ({
  prisma: {
    supplierPartner: { findUnique: jest.fn() },
    $transaction: jest.fn(),
  },
}));
jest.mock('../../src/modules/catalog/pricing-rule.repository', () => ({
  __esModule: true,
  default: { findDefault: jest.fn() },
}));
jest.mock('../../src/modules/catalog/category.repository', () => ({
  __esModule: true,
  default: { findById: jest.fn().mockResolvedValue({ id: 'cat-1' }) },
}));
jest.mock('../../src/modules/inventory/inventory.repository', () => ({
  __esModule: true,
  default: { findPrimaryLocation: jest.fn().mockResolvedValue(null), setStock: jest.fn() },
}));
jest.mock('../../src/modules/catalog/attribute.repository', () => ({
  __esModule: true,
  default: { upsertVariantAttributesFromLabels: jest.fn() },
}));
jest.mock('../../src/suppliers/supplier.registry', () => ({
  supplierRegistry: { get: jest.fn() },
}));

const db = prisma as unknown as {
  supplierPartner: { findUnique: jest.Mock };
  $transaction: jest.Mock;
};

const DAY = 24 * 60 * 60 * 1000;

const rule = (overrides: Record<string, unknown> = {}) => ({
  id: 'rule-1',
  isActive: true,
  markupType: 'PERCENTAGE',
  markupValue: 100,
  minimumProfit: null,
  saleType: null,
  saleValue: null,
  saleStartsAt: null,
  saleEndsAt: null,
  ...overrides,
});

// Two CJ variants costing $10 and $12.
const cjPayload = {
  pid: 'cj-1',
  productNameEn: 'Bluetooth Speaker',
  productKeyEn: 'Color',
  categoryName: 'Speakers',
  variants: [
    { vid: 'v1', variantKey: 'Black', variantSellPrice: 10 },
    { vid: 'v2', variantKey: 'White', variantSellPrice: 12 },
  ],
};

const importWithRule = async (pricingRule: ReturnType<typeof rule> | null) => {
  tx.catalogProduct.upsert.mockResolvedValue({ id: 'prod-1', pricingRule });
  return ProductImportService.importProduct('tenant-1', 'cj-dropshipping', cjPayload, 'cat-1');
};

beforeEach(() => {
  jest.clearAllMocks();
  db.supplierPartner.findUnique.mockResolvedValue({ id: 'sup-1' });
  db.$transaction.mockImplementation((fn: (client: typeof tx) => unknown) => fn(tx));
  (PricingRuleRepository.findDefault as jest.Mock).mockResolvedValue(null);
  (supplierRegistry.get as jest.Mock).mockReturnValue({
    getInventory: jest.fn().mockResolvedValue([]),
  });
  tx.catalogProduct.findUnique.mockResolvedValue(null);
  tx.catalogProduct.update.mockImplementation(({ data }) => ({ id: 'prod-1', ...data }));
  tx.supplierProduct.upsert.mockResolvedValue({ id: 'sp-1' });
  tx.supplierVariant.findUnique.mockResolvedValue(null);
  tx.catalogProductVariant.create.mockImplementation(({ data }) => ({ id: `var-${data.sku}` }));
});

describe('ProductImportService.importProduct — displayed product price', () => {
  it('sets the product price to the lowest marked-up variant price, not the raw cost', async () => {
    const product = await importWithRule(rule());

    const variantPrices = tx.catalogProductVariant.create.mock.calls.map(([a]) => a.data.price);
    expect(variantPrices).toEqual([20, 24]);
    expect(tx.catalogProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'prod-1' }, data: { price: 20, salePrice: null } }),
    );
    expect(product).toMatchObject({ price: 20, salePrice: null });
  });

  it('keeps the raw cost as the supplier cost price', async () => {
    await importWithRule(rule());

    expect(tx.supplierProduct.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ costPrice: 10 }) }),
    );
  });

  it('uses the cost as the price when the product has no pricing rule', async () => {
    await importWithRule(null);

    expect(tx.catalogProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { price: 10, salePrice: null } }),
    );
  });

  it("applies the rule's sale while its window is open", async () => {
    await importWithRule(
      rule({
        saleType: 'PERCENTAGE',
        saleValue: { toNumber: () => 10 },
        saleStartsAt: new Date(Date.now() - DAY),
        saleEndsAt: new Date(Date.now() + DAY),
      }),
    );

    expect(tx.catalogProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { price: 20, salePrice: 18 } }),
    );
  });

  it('ignores a sale whose window has ended', async () => {
    await importWithRule(
      rule({
        saleType: 'PERCENTAGE',
        saleValue: { toNumber: () => 10 },
        saleStartsAt: new Date(Date.now() - 2 * DAY),
        saleEndsAt: new Date(Date.now() - DAY),
      }),
    );

    expect(tx.catalogProduct.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { price: 20, salePrice: null } }),
    );
  });
});
