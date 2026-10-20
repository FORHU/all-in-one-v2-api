import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { enqueue } from '../../src/infrastructure/sqs/publisher';
import { QUEUES } from '../../src/infrastructure/sqs/queues';
import { asyncLocalStorage } from '../../src/utils/async-context';
import { JobQueueService } from '../../src/modules/system/job-queue.service';
import { JobService } from '../../src/modules/system/job.service';

jest.mock('../../src/modules/system/job.service', () => ({
  JobService: { updateJobStatus: jest.fn().mockResolvedValue(null) },
}));

const sqsMock = mockClient(SQSClient);

beforeEach(() => {
  sqsMock.reset();
  jest.clearAllMocks();
});

describe('SQS enqueue()', () => {
  it('sends the { metadata, payload } envelope with tracing attributes', async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: 'msg-123' });

    const messageId = await asyncLocalStorage.run(
      { requestId: 'req-1', correlationId: 'corr-1' },
      () => enqueue(QUEUES.PRODUCT_SYNC, 'product.sync', { jobId: 'job-1' }),
    );

    expect(messageId).toBe('msg-123');
    const input = sqsMock.commandCalls(SendMessageCommand)[0].args[0].input;
    expect(input.QueueUrl).toBe(process.env.PRODUCT_SYNC_QUEUE_URL);

    const body = JSON.parse(input.MessageBody!);
    expect(body.payload).toEqual({ jobId: 'job-1' });
    expect(body.metadata).toMatchObject({
      eventType: 'product.sync',
      correlationId: 'corr-1',
      requestId: 'req-1',
      version: '1',
    });
    expect(input.MessageAttributes).toMatchObject({
      eventType: { DataType: 'String', StringValue: 'product.sync' },
      correlationId: { DataType: 'String', StringValue: 'corr-1' },
      requestId: { DataType: 'String', StringValue: 'req-1' },
    });
  });

  it('omits tracing attributes when there is no request context', async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: 'msg-1' });

    await enqueue(QUEUES.SUPPLIER_REFUND, 'supplier-order.refund.requested', {});

    const input = sqsMock.commandCalls(SendMessageCommand)[0].args[0].input;
    expect(input.QueueUrl).toBe(process.env.SUPPLIER_REFUND_QUEUE_URL);
    expect(input.MessageAttributes).not.toHaveProperty('correlationId');
  });

  it('throws when the queue URL is not configured', async () => {
    await expect(enqueue({ name: 'supplier-refund', url: '' }, 'x', {})).rejects.toThrow(
      'SUPPLIER_REFUND_QUEUE_URL is not set',
    );
    expect(sqsMock.commandCalls(SendMessageCommand)).toHaveLength(0);
  });

  it('propagates SQS errors instead of reporting success', async () => {
    sqsMock.on(SendMessageCommand).rejects(new Error('AccessDenied'));
    await expect(enqueue(QUEUES.PRODUCT_SYNC, 'product.sync', {})).rejects.toThrow('AccessDenied');
  });
});

describe('JobQueueService.publishProductSyncJob', () => {
  it('queues the product sync message on the product-sync queue', async () => {
    sqsMock.on(SendMessageCommand).resolves({ MessageId: 'msg-1' });

    await JobQueueService.publishProductSyncJob('job-1', 'cj-dropshipping', {
      externalIds: ['a', 'b'],
    });

    const input = sqsMock.commandCalls(SendMessageCommand)[0].args[0].input;
    const { payload } = JSON.parse(input.MessageBody!);
    expect(input.QueueUrl).toBe(process.env.PRODUCT_SYNC_QUEUE_URL);
    expect(payload).toMatchObject({
      jobId: 'job-1',
      supplierId: 'cj-dropshipping',
      payload: { externalIds: ['a', 'b'] },
    });
    expect(JobService.updateJobStatus).not.toHaveBeenCalled();
  });

  it('marks the tracking job FAILED and rethrows when the enqueue fails', async () => {
    sqsMock.on(SendMessageCommand).rejects(new Error('queue does not exist'));

    await expect(
      JobQueueService.publishProductSyncJob('job-1', 'cj-dropshipping', { externalIds: ['a'] }),
    ).rejects.toThrow('queue does not exist');
    expect(JobService.updateJobStatus).toHaveBeenCalledWith('job-1', 'FAILED', expect.any(Error));
  });
});
