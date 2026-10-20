import { PaymentStatus } from '@prisma/client';
import { runWithTenant } from '../../src/utils/async-context';

jest.mock('../../src/modules/commerce/order.repository', () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateStatus: jest.fn(),
  },
}));

import OrderService from '../../src/modules/commerce/order.service';
import OrderRepository from '../../src/modules/commerce/order.repository';

const mockOrderRepo = OrderRepository as jest.Mocked<typeof OrderRepository>;

const TENANT_ID = 'tenant-1';
const ORDER_ID = 'order-1';

function run<T>(fn: () => Promise<T>) {
  return runWithTenant(TENANT_ID, fn);
}

describe('OrderService.cancelOrder', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('404s when the order does not exist', async () => {
    mockOrderRepo.findById.mockResolvedValue(null as never);

    await expect(run(() => OrderService.cancelOrder(ORDER_ID))).rejects.toMatchObject({
      status: 404,
    });
  });

  it('cancels an unpaid order with no supplier order yet', async () => {
    mockOrderRepo.findById.mockResolvedValue({
      payments: [],
      supplierOrders: [],
    } as never);
    mockOrderRepo.updateStatus.mockResolvedValue({ id: ORDER_ID } as never);

    const result = await run(() => OrderService.cancelOrder(ORDER_ID));

    expect(mockOrderRepo.updateStatus).toHaveBeenCalledWith(TENANT_ID, ORDER_ID, 'CANCELLED');
    expect(result).toEqual({ id: ORDER_ID });
  });

  it('409s when a payment on the order is already captured', async () => {
    mockOrderRepo.findById.mockResolvedValue({
      payments: [{ status: PaymentStatus.PAID }],
      supplierOrders: [],
    } as never);

    await expect(run(() => OrderService.cancelOrder(ORDER_ID))).rejects.toMatchObject({
      status: 409,
    });
    expect(mockOrderRepo.updateStatus).not.toHaveBeenCalled();
  });

  it('409s when the order has already been placed with a supplier, even if unpaid', async () => {
    mockOrderRepo.findById.mockResolvedValue({
      payments: [],
      supplierOrders: [{ id: 'supplier-order-1' }],
    } as never);

    await expect(run(() => OrderService.cancelOrder(ORDER_ID))).rejects.toMatchObject({
      status: 409,
    });
    expect(mockOrderRepo.updateStatus).not.toHaveBeenCalled();
  });
});
