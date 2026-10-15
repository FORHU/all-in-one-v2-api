import { handleProductSync } from '../../src/consumers/product-sync.consumer';
import { JobService } from '../../src/modules/system/job.service';
import { ProductImportService } from '../../src/modules/catalog/product-import.service';
import { supplierRegistry } from '../../src/suppliers/supplier.registry';
import { prisma } from '../../src/utils/prisma';
import type { JobContext } from '../../src/infrastructure/sqs';

jest.mock('../../src/utils/prisma', () => ({
  prisma: {
    job: { findUnique: jest.fn() },
    supplierPartner: { findUnique: jest.fn() },
    supplierProduct: {
      findUnique: jest.fn(),
      update: jest.fn().mockResolvedValue({}),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  },
}));

jest.mock('../../src/modules/system/job.service', () => ({
  JobService: {
    updateJobStatus: jest.fn().mockResolvedValue(null),
    updateJobPayload: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../../src/modules/catalog/product-import.service', () => ({
  ProductImportService: { importProduct: jest.fn().mockResolvedValue({}) },
}));

jest.mock('../../src/suppliers/supplier.registry', () => ({
  supplierRegistry: { get: jest.fn() },
}));

const db = prisma as unknown as {
  job: { findUnique: jest.Mock };
  supplierPartner: { findUnique: jest.Mock };
  supplierProduct: { findUnique: jest.Mock; update: jest.Mock; updateMany: jest.Mock };
};

const adapter = { getProduct: jest.fn() };

const message = {
  jobId: 'job-1',
  supplierId: 'cj-dropshipping',
  payload: { externalIds: ['p1', 'p2'] },
  timestamp: new Date().toISOString(),
};

const ctx = (receiveCount = 1, isFinalAttempt = false): JobContext => ({
  messageId: 'msg-1',
  receiveCount,
  isFinalAttempt,
  metadata: { eventId: 'e', eventType: 'product.sync', timestamp: '', version: '1' },
});

beforeEach(() => {
  jest.clearAllMocks();
  (supplierRegistry.get as jest.Mock).mockReturnValue(adapter);
  db.job.findUnique.mockResolvedValue({ status: 'PENDING' });
  db.supplierPartner.findUnique.mockResolvedValue({ id: 'sup-1', name: 'cj-dropshipping' });
  db.supplierProduct.findUnique.mockResolvedValue({ product: { tenantId: 'tenant-1' } });
});

describe('handleProductSync', () => {
  it('imports each product and completes the job, counting per-product failures', async () => {
    adapter.getProduct
      .mockResolvedValueOnce({ pid: 'p1', sellPrice: '9.5' })
      .mockResolvedValueOnce(null);

    await handleProductSync(message, ctx());

    expect(JobService.updateJobStatus).toHaveBeenCalledWith('job-1', 'PROCESSING');
    expect(ProductImportService.importProduct).toHaveBeenCalledWith(
      'tenant-1',
      'cj-dropshipping',
      expect.objectContaining({ pid: 'p1' }),
    );
    expect(JobService.updateJobPayload).toHaveBeenCalledWith('job-1', {
      successCount: 1,
      failCount: 1,
    });
    expect(JobService.updateJobStatus).toHaveBeenLastCalledWith('job-1', 'COMPLETED');
  });

  it.each(['COMPLETED', 'FAILED', 'CANCELLED'])(
    'skips a duplicate delivery for a job that is already %s',
    async (status) => {
      db.job.findUnique.mockResolvedValue({ status });

      await handleProductSync(message, ctx(2));

      expect(adapter.getProduct).not.toHaveBeenCalled();
      expect(JobService.updateJobStatus).not.toHaveBeenCalled();
    },
  );

  it('re-runs a job left PROCESSING by a crashed worker', async () => {
    db.job.findUnique.mockResolvedValue({ status: 'PROCESSING' });
    adapter.getProduct.mockResolvedValue({ pid: 'p' });

    await handleProductSync(message, ctx(2));

    expect(adapter.getProduct).toHaveBeenCalledTimes(2);
    expect(JobService.updateJobStatus).toHaveBeenLastCalledWith('job-1', 'COMPLETED');
  });

  it('rethrows a job-level failure for retry, recording the error but not FAILED yet', async () => {
    db.supplierPartner.findUnique.mockResolvedValue(null);

    await expect(handleProductSync(message, ctx(1, false))).rejects.toThrow(
      'Supplier cj-dropshipping not found in database',
    );

    expect(JobService.updateJobStatus).not.toHaveBeenCalledWith(
      'job-1',
      'FAILED',
      expect.anything(),
    );
    expect(JobService.updateJobPayload).toHaveBeenCalledWith(
      'job-1',
      expect.objectContaining({ attempts: 1, lastError: expect.stringContaining('not found') }),
    );
  });

  it('marks the job FAILED on the final attempt and still rethrows (so it lands in the DLQ)', async () => {
    db.supplierPartner.findUnique.mockRejectedValue(new Error('DB unreachable'));

    await expect(handleProductSync(message, ctx(3, true))).rejects.toThrow('DB unreachable');

    expect(JobService.updateJobStatus).toHaveBeenCalledWith('job-1', 'FAILED', expect.any(Error));
  });

  it('rejects a payload missing required fields', async () => {
    await expect(handleProductSync({ ...message, payload: {} as never }, ctx())).rejects.toThrow(
      'Invalid payload',
    );
    expect(db.job.findUnique).not.toHaveBeenCalled();
  });
});
