import OrderRepository from '../../src/modules/commerce/order.repository';
import { prisma } from '../../src/utils/prisma';

jest.mock('../../src/utils/prisma', () => ({
  prisma: {
    commerceSupplierOrder: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
    },
  },
}));

const supplierOrder = prisma.commerceSupplierOrder as unknown as {
  findUnique: jest.Mock;
  update: jest.Mock;
};

const lastWrittenRawResponse = () =>
  supplierOrder.update.mock.calls.at(-1)![0].data.rawResponse as Record<string, unknown>;

beforeEach(() => jest.clearAllMocks());

describe('OrderRepository supplier refund request tracking', () => {
  it('reads the state of one Refund and ignores others', async () => {
    supplierOrder.findUnique.mockResolvedValue({
      rawResponse: {
        supplierRefundRequests: {
          'refund-1': { state: 'DONE' },
          'refund-2': { state: 'IN_PROGRESS' },
        },
      },
    });

    await expect(OrderRepository.getSupplierRefundRequestState('so-1', 'refund-1')).resolves.toBe(
      'DONE',
    );
    await expect(
      OrderRepository.getSupplierRefundRequestState('so-1', 'refund-3'),
    ).resolves.toBeUndefined();
  });

  it('marks and clears IN_PROGRESS without touching the rest of rawResponse', async () => {
    supplierOrder.findUnique.mockResolvedValue({
      rawResponse: { cjOrderId: 'CJ-1', supplierRefundRequests: { other: { state: 'DONE' } } },
    });

    await OrderRepository.setSupplierRefundRequestInProgress('so-1', 'refund-1', true);
    expect(lastWrittenRawResponse()).toMatchObject({
      cjOrderId: 'CJ-1',
      supplierRefundRequests: { other: { state: 'DONE' }, 'refund-1': { state: 'IN_PROGRESS' } },
    });

    await OrderRepository.setSupplierRefundRequestInProgress('so-1', 'refund-1', false);
    expect(lastWrittenRawResponse()).toEqual({
      cjOrderId: 'CJ-1',
      supplierRefundRequests: { other: { state: 'DONE' } },
    });
  });

  it('records the outcome as DONE and keeps the legacy `refund` key up to date', async () => {
    supplierOrder.findUnique.mockResolvedValue({
      rawResponse: { supplierRefundRequests: { 'refund-1': { state: 'IN_PROGRESS' } } },
    });

    await OrderRepository.recordSupplierRefundResult(
      'so-1',
      { requested: true, externalRefundId: 'D-1' },
      'refund-1',
    );

    expect(lastWrittenRawResponse()).toMatchObject({
      refund: { requested: true, externalRefundId: 'D-1' },
      supplierRefundRequests: { 'refund-1': { state: 'DONE', requested: true } },
    });
  });
});
