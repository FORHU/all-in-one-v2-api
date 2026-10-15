import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  ChangeMessageVisibilityCommand,
  type Message,
} from '@aws-sdk/client-sqs';
import { mockClient } from 'aws-sdk-client-mock';
import { setTimeout as sleep } from 'node:timers/promises';
import { consume, JobContext } from '../../src/infrastructure/sqs/consumer';
import { getCorrelationId } from '../../src/utils/async-context';

const sqsMock = mockClient(SQSClient);
const QUEUE = { name: 'test-queue', url: 'http://localhost:4566/000000000000/test-queue' };

const envelope = (payload: unknown, metadata: Record<string, unknown> = {}) =>
  JSON.stringify({
    metadata: {
      eventId: 'evt-1',
      eventType: 'test.event',
      timestamp: new Date().toISOString(),
      version: '1',
      ...metadata,
    },
    payload,
  });

const message = (body: string, overrides: Partial<Message> = {}): Message => ({
  MessageId: 'msg-1',
  ReceiptHandle: 'receipt-1',
  Body: body,
  Attributes: { ApproximateReceiveCount: '1' },
  ...overrides,
});

/** First poll returns `messages`; every poll after that is empty (after a short wait). */
const deliverOnce = (messages: Message[]) => {
  sqsMock
    .on(ReceiveMessageCommand)
    .resolvesOnce({ Messages: messages })
    .callsFake(async () => {
      await sleep(10);
      return { Messages: [] };
    });
};

const waitFor = async (condition: () => boolean, timeoutMs = 3000) => {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await sleep(10);
  }
};

const callsOf = <T extends new (...args: never[]) => unknown>(command: T) =>
  sqsMock
    .commandCalls(command as never)
    .map((call) => call.args[0].input as Record<string, unknown>);

const fastOptions = { waitTimeSeconds: 0, receiveErrorBackoffMs: 10, maxReceiveCount: 3 };

beforeEach(() => {
  sqsMock.reset();
  sqsMock.on(DeleteMessageCommand).resolves({});
  sqsMock.on(ChangeMessageVisibilityCommand).resolves({});
});

describe('SQS consume()', () => {
  it('runs the handler with the payload and deletes the message on success', async () => {
    deliverOnce([message(envelope({ hello: 'world' }))]);
    const handler = jest.fn().mockResolvedValue(undefined);

    const consumer = consume(QUEUE, handler, fastOptions);
    await waitFor(() => callsOf(DeleteMessageCommand).length === 1);
    await consumer.stop();

    expect(handler).toHaveBeenCalledTimes(1);
    const [payload, ctx] = handler.mock.calls[0] as [unknown, JobContext];
    expect(payload).toEqual({ hello: 'world' });
    expect(ctx).toMatchObject({ messageId: 'msg-1', receiveCount: 1, isFinalAttempt: false });
    expect(ctx.metadata.eventType).toBe('test.event');
    expect(callsOf(DeleteMessageCommand)[0]).toEqual({
      QueueUrl: QUEUE.url,
      ReceiptHandle: 'receipt-1',
    });
  });

  it('never deletes a failed job — it schedules a retry after retryDelaySeconds', async () => {
    deliverOnce([message(envelope({}))]);
    const handler = jest.fn().mockRejectedValue(new Error('boom'));

    const consumer = consume(QUEUE, handler, { ...fastOptions, retryDelaySeconds: 42 });
    await waitFor(() => callsOf(ChangeMessageVisibilityCommand).length > 0);
    await consumer.stop();

    expect(callsOf(DeleteMessageCommand)).toHaveLength(0);
    expect(callsOf(ChangeMessageVisibilityCommand)).toContainEqual(
      expect.objectContaining({ ReceiptHandle: 'receipt-1', VisibilityTimeout: 42 }),
    );
  });

  it('flags the attempt that will move the message to the DLQ as final', async () => {
    deliverOnce([message(envelope({}), { Attributes: { ApproximateReceiveCount: '3' } })]);
    const handler = jest.fn().mockResolvedValue(undefined);

    const consumer = consume(QUEUE, handler, fastOptions);
    await waitFor(() => handler.mock.calls.length === 1);
    await consumer.stop();

    expect(handler.mock.calls[0][1]).toMatchObject({ receiveCount: 3, isFinalAttempt: true });
  });

  it.each([
    ['invalid JSON', 'not json {'],
    ['JSON without the envelope', JSON.stringify({ jobId: 'x' })],
  ])('drops a malformed message (%s) without running or retrying it', async (_label, body) => {
    deliverOnce([message(body)]);
    const handler = jest.fn();

    const consumer = consume(QUEUE, handler, fastOptions);
    await waitFor(() => callsOf(DeleteMessageCommand).length === 1);
    await consumer.stop();

    expect(handler).not.toHaveBeenCalled();
    expect(callsOf(ChangeMessageVisibilityCommand)).toHaveLength(0);
  });

  it('restores the correlationId from message attributes for the handler', async () => {
    deliverOnce([
      message(envelope({}, { correlationId: 'from-envelope' }), {
        MessageAttributes: { correlationId: { DataType: 'String', StringValue: 'from-attr' } },
      }),
    ]);
    let seen: string | undefined;
    const handler = jest.fn(async () => {
      seen = getCorrelationId();
    });

    const consumer = consume(QUEUE, handler, fastOptions);
    await waitFor(() => handler.mock.calls.length === 1);
    await consumer.stop();

    expect(seen).toBe('from-attr');
  });

  it('uses the eventId as correlationId for jobs queued outside a request', async () => {
    deliverOnce([message(envelope({}, { eventId: 'evt-scheduler-42' }))]);
    let seen: string | undefined;
    const handler = jest.fn(async () => {
      seen = getCorrelationId();
    });

    const consumer = consume(QUEUE, handler, fastOptions);
    await waitFor(() => handler.mock.calls.length === 1);
    await consumer.stop();

    expect(seen).toBe('evt-scheduler-42');
  });

  it('extends visibility while a long job runs (heartbeat)', async () => {
    deliverOnce([message(envelope({}))]);
    const handler = jest.fn(() => sleep(1500));

    // visibility 3s → heartbeat every 1s
    const consumer = consume(QUEUE, handler, { ...fastOptions, visibilityTimeout: 3 });
    await waitFor(() => callsOf(DeleteMessageCommand).length === 1, 5000);
    await consumer.stop();

    expect(callsOf(ChangeMessageVisibilityCommand)).toContainEqual(
      expect.objectContaining({ ReceiptHandle: 'receipt-1', VisibilityTimeout: 3 }),
    );
  });

  it('stop() waits for the running job to finish and delete it', async () => {
    deliverOnce([message(envelope({}))]);
    let finished = false;
    const handler = jest.fn(async () => {
      await sleep(300);
      finished = true;
    });

    const consumer = consume(QUEUE, handler, fastOptions);
    await waitFor(() => handler.mock.calls.length === 1);
    await consumer.stop();

    expect(finished).toBe(true);
    expect(callsOf(DeleteMessageCommand)).toHaveLength(1);
  });

  it('hands back messages received while stopping instead of running them', async () => {
    sqsMock.on(ReceiveMessageCommand).callsFake(async () => {
      await sleep(100); // poll still open when stop() is called
      return { Messages: [message(envelope({}))] };
    });
    const handler = jest.fn();

    const consumer = consume(QUEUE, handler, fastOptions);
    await sleep(20);
    await consumer.stop();

    expect(handler).not.toHaveBeenCalled();
    expect(callsOf(ChangeMessageVisibilityCommand)).toContainEqual(
      expect.objectContaining({ ReceiptHandle: 'receipt-1', VisibilityTimeout: 0 }),
    );
  });

  it('keeps polling after a failed receive', async () => {
    sqsMock
      .on(ReceiveMessageCommand)
      .rejectsOnce(new Error('network down'))
      .resolvesOnce({ Messages: [message(envelope({}))] })
      .callsFake(async () => {
        await sleep(10);
        return { Messages: [] };
      });
    const handler = jest.fn().mockResolvedValue(undefined);

    const consumer = consume(QUEUE, handler, fastOptions);
    await waitFor(() => handler.mock.calls.length === 1);
    await consumer.stop();

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('receives no more messages than it can run at once (capped at 10)', async () => {
    deliverOnce([]);
    const consumer = consume(QUEUE, jest.fn(), { ...fastOptions, concurrency: 25 });
    await waitFor(() => callsOf(ReceiveMessageCommand).length > 0);
    await consumer.stop();

    expect(callsOf(ReceiveMessageCommand)[0]).toMatchObject({
      QueueUrl: QUEUE.url,
      MaxNumberOfMessages: 10,
      MessageSystemAttributeNames: ['ApproximateReceiveCount'],
    });
  });

  it('refuses to start without a queue URL', () => {
    expect(() => consume({ name: 'product-sync', url: '' }, jest.fn())).toThrow(
      'PRODUCT_SYNC_QUEUE_URL is not set',
    );
  });
});
