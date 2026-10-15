import {
  handleSupplierRefund,
  SupplierRefundPayload,
} from '../../src/consumers/supplier-refund.consumer';
import OrderRepository from '../../src/modules/commerce/order.repository';
import { supplierRegistry } from '../../src/suppliers/supplier.registry';
import { getTenantId } from '../../src/utils/async-context';
import type { JobContext } from '../../src/infrastructure/sqs';

jest.mock('../../src/modules/commerce/order.repository', () => ({
  __esModule: true,
  default: {
    getSupplierRefundRequestState: jest.fn(),
    setSupplierRefundRequestInProgress: jest.fn().mockResolvedValue({}),
    recordSupplierRefundResult: jest.fn().mockResolvedValue({}),
  },
}));

jest.mock('../../src/suppliers/supplier.registry', () => ({
  supplierRegistry: { get: jest.fn() },
}));

const repo = OrderRepository as unknown as {
  getSupplierRefundRequestState: jest.Mock;
  setSupplierRefundRequestInProgress: jest.Mock;
  recordSupplierRefundResult: jest.Mock;
};

const payload: SupplierRefundPayload = {
  tenantId: 'tenant-1',
  refundId: 'refund-1',
  supplierOrderId: 'so-1',
  supplierId: 'cj-dropshipping',
  externalId: 'CJ-ORDER-9',
  reason: 'Damaged item',
};

const ctx: JobContext = {
  messageId: 'msg-1',
  receiveCount: 1,
  isFinalAttempt: false,
  metadata: { eventId: 'e', eventType: 'x', timestamp: '', version: '1' },
};

const adapter = { requestRefund: jest.fn() };

beforeEach(() => {
  jest.clearAllMocks();
  (supplierRegistry.get as jest.Mock).mockReturnValue(adapter);
  repo.getSupplierRefundRequestState.mockResolvedValue(undefined);
});

describe('handleSupplierRefund', () => {
  it('files the refund with the supplier once, inside the tenant context, and records it', async () => {
    let tenantDuringCall: string | undefined;
    adapter.requestRefund.mockImplementation(async () => {
      tenantDuringCall = getTenantId();
      return { requested: true, externalRefundId: 'D-1' };
    });

    await handleSupplierRefund(payload, ctx);

    expect(tenantDuringCall).toBe('tenant-1');
    expect(repo.setSupplierRefundRequestInProgress).toHaveBeenCalledWith('so-1', 'refund-1', true);
    expect(adapter.requestRefund).toHaveBeenCalledWith({
      orderId: 'CJ-ORDER-9',
      reason: 'Damaged item',
    });
    expect(repo.recordSupplierRefundResult).toHaveBeenCalledWith(
      'so-1',
      { requested: true, externalRefundId: 'D-1' },
      'refund-1',
    );
  });

  it('calls the supplier only once when SQS delivers the same message twice', async () => {
    adapter.requestRefund.mockResolvedValue({ requested: true });
    repo.getSupplierRefundRequestState
      .mockResolvedValueOnce(undefined) // first delivery
      .mockResolvedValueOnce('DONE'); // redelivery

    await handleSupplierRefund(payload, ctx);
    await handleSupplierRefund(payload, { ...ctx, receiveCount: 2 });

    expect(adapter.requestRefund).toHaveBeenCalledTimes(1);
    expect(repo.recordSupplierRefundResult).toHaveBeenCalledTimes(1);
  });

  it('does not call the supplier again after an interrupted attempt — flags it for review', async () => {
    repo.getSupplierRefundRequestState.mockResolvedValue('IN_PROGRESS');

    await handleSupplierRefund(payload, { ...ctx, receiveCount: 2 });

    expect(adapter.requestRefund).not.toHaveBeenCalled();
    expect(repo.recordSupplierRefundResult).toHaveBeenCalledWith(
      'so-1',
      expect.objectContaining({
        requested: false,
        raw: expect.objectContaining({ needsManualReview: true }),
      }),
      'refund-1',
    );
  });

  it('clears the in-progress marker and rethrows when the supplier call fails, so it is retried', async () => {
    adapter.requestRefund.mockRejectedValue(new Error('CJ 503'));

    await expect(handleSupplierRefund(payload, ctx)).rejects.toThrow('CJ 503');

    expect(repo.setSupplierRefundRequestInProgress).toHaveBeenNthCalledWith(
      1,
      'so-1',
      'refund-1',
      true,
    );
    expect(repo.setSupplierRefundRequestInProgress).toHaveBeenNthCalledWith(
      2,
      'so-1',
      'refund-1',
      false,
    );
    expect(repo.recordSupplierRefundResult).not.toHaveBeenCalled();
  });

  it('records "not supported" for suppliers without requestRefund, without retrying', async () => {
    (supplierRegistry.get as jest.Mock).mockReturnValue({});

    await handleSupplierRefund({ ...payload, supplierId: 'printful' }, ctx);

    expect(repo.setSupplierRefundRequestInProgress).not.toHaveBeenCalled();
    expect(repo.recordSupplierRefundResult).toHaveBeenCalledWith(
      'so-1',
      expect.objectContaining({ requested: false }),
      'refund-1',
    );
  });

  it('rejects a payload without a refundId (no idempotency key)', async () => {
    await expect(handleSupplierRefund({ ...payload, refundId: '' }, ctx)).rejects.toThrow(
      'Invalid payload',
    );
    expect(adapter.requestRefund).not.toHaveBeenCalled();
  });
});
