import { SupplierOrderStatus } from '@prisma/client';
import { runWithTenant } from '../../src/utils/async-context';

jest.mock('../../src/modules/commerce/order.repository', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findSupplierOrderForOrder: jest.fn(),
    createSupplierOrderWithItems: jest.fn(),
  },
}));

jest.mock('../../src/modules/supplier/supplier.repository', () => ({
  __esModule: true,
  default: {
    findPartnerByName: jest.fn(),
    findVariantMappingsBySupplier: jest.fn(),
  },
}));

jest.mock('../../src/suppliers/supplier.registry', () => ({
  supplierRegistry: { get: jest.fn() },
}));

import CJOrderFulfillmentService from '../../src/modules/commerce/cj-order-fulfillment.service';
import OrderRepository from '../../src/modules/commerce/order.repository';
import SupplierRepository from '../../src/modules/supplier/supplier.repository';
import { supplierRegistry } from '../../src/suppliers/supplier.registry';

const mockOrderRepo = OrderRepository as jest.Mocked<typeof OrderRepository>;
const mockSupplierRepo = SupplierRepository as jest.Mocked<typeof SupplierRepository>;
const mockRegistry = supplierRegistry as unknown as { get: jest.Mock };

const TENANT_ID = 'tenant-1';
const ORDER_ID = 'order-1';

const baseOrder = {
  id: ORDER_ID,
  orderNumber: 'ORD-00000001',
  shippingAddress: {
    fullName: 'Jane Doe',
    addressLine1: '123 Main St',
    addressLine2: null,
    city: 'Manila',
    state: 'NCR',
    postalCode: '1000',
    country: 'PH',
    phone: '09171234567',
  },
  items: [
    { id: 'item-1', productVariantId: 'variant-1', quantity: 2, productTitle: 'Shirt' },
    { id: 'item-2', productVariantId: 'variant-2', quantity: 1, productTitle: 'Hat' },
  ],
};

function run<T>(fn: () => Promise<T>) {
  return runWithTenant(TENANT_ID, fn);
}

describe('CJOrderFulfillmentService.placeOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupplierRepo.findPartnerByName.mockResolvedValue({
      id: 'partner-1',
      name: 'cj-dropshipping',
    } as never);
    mockOrderRepo.findSupplierOrderForOrder.mockResolvedValue(null);
  });

  it('404s when the order does not exist', async () => {
    mockOrderRepo.findById.mockResolvedValue(null as never);

    await expect(run(() => CJOrderFulfillmentService.placeOrder(ORDER_ID))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('409s when this order was already placed with CJ', async () => {
    mockOrderRepo.findById.mockResolvedValue(baseOrder as never);
    mockOrderRepo.findSupplierOrderForOrder.mockResolvedValue({ id: 'supplier-order-1' } as never);

    await expect(run(() => CJOrderFulfillmentService.placeOrder(ORDER_ID))).rejects.toMatchObject({
      status: 409,
    });
  });

  it('400s when the order has no shipping address', async () => {
    mockOrderRepo.findById.mockResolvedValue({ ...baseOrder, shippingAddress: null } as never);

    await expect(run(() => CJOrderFulfillmentService.placeOrder(ORDER_ID))).rejects.toMatchObject({
      status: 400,
    });
  });

  it('422s when an item is not sourced from CJ', async () => {
    mockOrderRepo.findById.mockResolvedValue(baseOrder as never);
    mockSupplierRepo.findVariantMappingsBySupplier.mockResolvedValue(
      new Map([['variant-1', 'cj-vid-1']]), // variant-2 missing
    );

    await expect(run(() => CJOrderFulfillmentService.placeOrder(ORDER_ID))).rejects.toMatchObject({
      status: 422,
    });
  });

  it('502s when the CJ adapter rejects the order', async () => {
    mockOrderRepo.findById.mockResolvedValue(baseOrder as never);
    mockSupplierRepo.findVariantMappingsBySupplier.mockResolvedValue(
      new Map([
        ['variant-1', 'cj-vid-1'],
        ['variant-2', 'cj-vid-2'],
      ]),
    );
    mockRegistry.get.mockReturnValue({ placeAndPayOrder: jest.fn().mockResolvedValue(null) });

    await expect(run(() => CJOrderFulfillmentService.placeOrder(ORDER_ID))).rejects.toMatchObject({
      status: 502,
    });
  });

  it('places the order, splits the shipping name, and records the CommerceSupplierOrder', async () => {
    mockOrderRepo.findById.mockResolvedValue(baseOrder as never);
    mockSupplierRepo.findVariantMappingsBySupplier.mockResolvedValue(
      new Map([
        ['variant-1', 'cj-vid-1'],
        ['variant-2', 'cj-vid-2'],
      ]),
    );
    const placeAndPayOrder = jest
      .fn()
      .mockResolvedValue({ orderId: 'CJ-REAL-1', paid: true, logisticsAutoCorrected: true });
    mockRegistry.get.mockReturnValue({ placeAndPayOrder });
    mockOrderRepo.createSupplierOrderWithItems.mockResolvedValue({
      id: 'supplier-order-1',
    } as never);

    const result = await run(() => CJOrderFulfillmentService.placeOrder(ORDER_ID));

    expect(mockRegistry.get).toHaveBeenCalledWith('cj-dropshipping');
    expect(placeAndPayOrder).toHaveBeenCalledWith({
      orderId: 'ORD-00000001',
      items: [
        { productVariantId: 'variant-1', supplierVariantExternalId: 'cj-vid-1', quantity: 2 },
        { productVariantId: 'variant-2', supplierVariantExternalId: 'cj-vid-2', quantity: 1 },
      ],
      shippingAddress: {
        firstName: 'Jane',
        lastName: 'Doe',
        phone: '09171234567',
        address1: '123 Main St',
        address2: undefined,
        city: 'Manila',
        state: 'NCR',
        country: 'PH',
        zip: '1000',
      },
    });
    expect(mockOrderRepo.createSupplierOrderWithItems).toHaveBeenCalledWith(
      TENANT_ID,
      ORDER_ID,
      'partner-1',
      'CJ-REAL-1',
      SupplierOrderStatus.CONFIRMED,
      { logisticsAutoCorrected: true, paid: true },
      ['item-1', 'item-2'],
    );
    expect(result).toEqual({ id: 'supplier-order-1' });
  });

  it('uses a single-word name for both firstName and lastName', async () => {
    mockOrderRepo.findById.mockResolvedValue({
      ...baseOrder,
      shippingAddress: { ...baseOrder.shippingAddress, fullName: 'Cher' },
    } as never);
    mockSupplierRepo.findVariantMappingsBySupplier.mockResolvedValue(
      new Map([
        ['variant-1', 'cj-vid-1'],
        ['variant-2', 'cj-vid-2'],
      ]),
    );
    const placeAndPayOrder = jest
      .fn()
      .mockResolvedValue({ orderId: 'CJ-REAL-2', paid: false, logisticsAutoCorrected: false });
    mockRegistry.get.mockReturnValue({ placeAndPayOrder });
    mockOrderRepo.createSupplierOrderWithItems.mockResolvedValue({} as never);

    await run(() => CJOrderFulfillmentService.placeOrder(ORDER_ID));

    expect(placeAndPayOrder).toHaveBeenCalledWith(
      expect.objectContaining({
        shippingAddress: expect.objectContaining({ firstName: 'Cher', lastName: 'Cher' }),
      }),
    );
    expect(mockOrderRepo.createSupplierOrderWithItems).toHaveBeenCalledWith(
      TENANT_ID,
      ORDER_ID,
      'partner-1',
      'CJ-REAL-2',
      SupplierOrderStatus.PLACED,
      { logisticsAutoCorrected: false, paid: false },
      ['item-1', 'item-2'],
    );
  });
});
