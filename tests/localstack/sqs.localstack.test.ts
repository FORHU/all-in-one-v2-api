/**
 * End-to-end SQS behaviour against a real LocalStack — not mocks.
 *
 *   docker compose up -d --wait localstack
 *   npm run test:localstack
 *
 * Each run creates its own throwaway queues (short timeouts, maxReceiveCount 2)
 * so it never touches the app's product-sync/supplier-refund queues, then
 * deletes them. The last block checks those real queues as init-queues.sh
 * created them.
 */
import {
  CreateQueueCommand,
  DeleteQueueCommand,
  GetQueueAttributesCommand,
  ReceiveMessageCommand,
  SendMessageCommand,
  SetQueueAttributesCommand,
} from '@aws-sdk/client-sqs';
import { setTimeout as sleep } from 'node:timers/promises';
import { sqsClient } from '../../src/infrastructure/sqs/client';
import { consume } from '../../src/infrastructure/sqs/consumer';
import { enqueue } from '../../src/infrastructure/sqs/publisher';
import { QUEUES } from '../../src/infrastructure/sqs/queues';
import { sqs } from '../../src/infrastructure/sqs';

const MAX_RECEIVES = 2;
const runId = Date.now().toString(36);
const createdQueueUrls: string[] = [];

interface TestQueue {
  name: string;
  url: string;
  dlqUrl: string;
}

const createQueuePair = async (suffix: string, visibilityTimeout = 5): Promise<TestQueue> => {
  const name = `it-${runId}-${suffix}`;
  const dlq = await sqsClient.send(new CreateQueueCommand({ QueueName: `${name}-dlq` }));
  const dlqArn = (
    await sqsClient.send(
      new GetQueueAttributesCommand({ QueueUrl: dlq.QueueUrl!, AttributeNames: ['QueueArn'] }),
    )
  ).Attributes!.QueueArn!;
  const main = await sqsClient.send(new CreateQueueCommand({ QueueName: name }));
  await sqsClient.send(
    new SetQueueAttributesCommand({
      QueueUrl: main.QueueUrl!,
      Attributes: {
        VisibilityTimeout: String(visibilityTimeout),
        RedrivePolicy: JSON.stringify({
          deadLetterTargetArn: dlqArn,
          maxReceiveCount: String(MAX_RECEIVES),
        }),
      },
    }),
  );
  createdQueueUrls.push(main.QueueUrl!, dlq.QueueUrl!);
  return { name, url: main.QueueUrl!, dlqUrl: dlq.QueueUrl! };
};

const depth = async (queueUrl: string) => {
  const { Attributes } = await sqsClient.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ['ApproximateNumberOfMessages', 'ApproximateNumberOfMessagesNotVisible'],
    }),
  );
  return (
    Number(Attributes!.ApproximateNumberOfMessages) +
    Number(Attributes!.ApproximateNumberOfMessagesNotVisible)
  );
};

const waitFor = async (condition: () => boolean | Promise<boolean>, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await sleep(200);
  }
};

// Short long-poll so stop() returns quickly between tests.
const fast = { waitTimeSeconds: 1, maxReceiveCount: MAX_RECEIVES };

afterAll(async () => {
  await Promise.all(
    createdQueueUrls.map((QueueUrl) =>
      sqsClient.send(new DeleteQueueCommand({ QueueUrl })).catch(() => {}),
    ),
  );
});

describe('SQS against LocalStack', () => {
  it('round trip: enqueue → handled once → deleted', async () => {
    const q = await createQueuePair('roundtrip');
    const handled: unknown[] = [];

    await enqueue(q, 'test.event', { n: 1 });
    const consumer = consume(q, async (payload) => void handled.push(payload), fast);
    await waitFor(() => handled.length === 1);
    await consumer.stop();

    expect(handled).toEqual([{ n: 1 }]);
    await waitFor(async () => (await depth(q.url)) === 0);
  });

  it('a job that always fails runs maxReceiveCount times, then moves to the DLQ', async () => {
    const q = await createQueuePair('dlq');
    const attempts: number[] = [];

    await enqueue(q, 'test.event', { poison: true });
    const consumer = consume(
      q,
      async (_payload, ctx) => {
        attempts.push(ctx.receiveCount);
        throw new Error('always fails');
      },
      { ...fast, retryDelaySeconds: 1 },
    );
    await waitFor(async () => (await depth(q.dlqUrl)) === 1);
    await consumer.stop();

    expect(attempts).toEqual([1, 2]);
    expect(await depth(q.url)).toBe(0);
    const parked = await sqsClient.send(
      new ReceiveMessageCommand({ QueueUrl: q.dlqUrl, VisibilityTimeout: 0 }),
    );
    expect(JSON.parse(parked.Messages![0].Body!).payload).toEqual({ poison: true });
  });

  it('a failed job is retried and can succeed on the next attempt', async () => {
    const q = await createQueuePair('retry');
    const attempts: number[] = [];

    await enqueue(q, 'test.event', {});
    const consumer = consume(
      q,
      async (_payload, ctx) => {
        attempts.push(ctx.receiveCount);
        if (ctx.receiveCount === 1) throw new Error('transient');
      },
      { ...fast, retryDelaySeconds: 1 },
    );
    await waitFor(() => attempts.length === 2);
    await consumer.stop();

    await waitFor(async () => (await depth(q.url)) === 0);
    expect(await depth(q.dlqUrl)).toBe(0);
  });

  it('a malformed message is dropped — not retried, not sent to the DLQ', async () => {
    const q = await createQueuePair('malformed');
    const handler = jest.fn();

    await sqsClient.send(new SendMessageCommand({ QueueUrl: q.url, MessageBody: 'not json {' }));
    const consumer = consume(q, handler, fast);
    await waitFor(async () => (await depth(q.url)) === 0);
    await consumer.stop();

    expect(handler).not.toHaveBeenCalled();
    expect(await depth(q.dlqUrl)).toBe(0);
  });

  it('jobs longer than the visibility timeout run exactly once across two workers', async () => {
    const q = await createQueuePair('heartbeat', 2);
    const runs: string[] = [];
    const handler = async (payload: unknown) => {
      runs.push(JSON.stringify(payload));
      await sleep(5000); // 2.5× the visibility timeout
    };

    await enqueue(q, 'test.event', { job: 'a' });
    await enqueue(q, 'test.event', { job: 'b' });
    const workers = [
      consume(q, handler, { ...fast, visibilityTimeout: 2 }),
      consume(q, handler, { ...fast, visibilityTimeout: 2 }),
    ];
    await waitFor(async () => runs.length >= 2 && (await depth(q.url)) === 0, 40_000);
    await sleep(3000); // a redelivery would show up within one more visibility window
    await Promise.all(workers.map((w) => w.stop()));

    expect(runs.sort()).toEqual([JSON.stringify({ job: 'a' }), JSON.stringify({ job: 'b' })]);
  });

  it('stop() waits for the running job, which is then deleted', async () => {
    const q = await createQueuePair('shutdown');
    let started = false;
    let finished = false;

    await enqueue(q, 'test.event', {});
    const consumer = consume(
      q,
      async () => {
        started = true;
        await sleep(1500);
        finished = true;
      },
      fast,
    );
    await waitFor(() => started);
    await consumer.stop();

    expect(finished).toBe(true);
    await waitFor(async () => (await depth(q.url)) === 0);
  });

  describe('app queues created by docker/localstack/init-queues.sh', () => {
    it.each([QUEUES.PRODUCT_SYNC, QUEUES.SUPPLIER_REFUND])(
      '$name exists with a DLQ redrive policy',
      async (queue) => {
        const { Attributes } = await sqsClient.send(
          new GetQueueAttributesCommand({ QueueUrl: queue.url, AttributeNames: ['All'] }),
        );
        const redrive = JSON.parse(Attributes!.RedrivePolicy!);
        expect(redrive.deadLetterTargetArn).toMatch(new RegExp(`:${queue.name}-dlq$`));
        expect(Number(redrive.maxReceiveCount)).toBe(Number(process.env.SQS_MAX_RECEIVE_COUNT));
      },
    );

    it('sqs.isReady() reports the configured queues as reachable', async () => {
      await expect(sqs.isReady()).resolves.toBe(true);
    });
  });
});
