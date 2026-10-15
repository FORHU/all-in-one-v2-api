import {
  ChangeMessageVisibilityCommand,
  DeleteMessageCommand,
  ReceiveMessageCommand,
  type Message,
} from '@aws-sdk/client-sqs';
import { setTimeout as sleep } from 'node:timers/promises';
import { v4 as uuidv4 } from 'uuid';
import { sqsClient } from './client';
import { QueueDefinition, requireQueueUrl } from './queues';
import { DomainEvent, EventMetadata } from './publisher';
import { asyncLocalStorage } from '../../utils/async-context';
import { workerMetrics } from '../../utils/worker-metrics';
import logger from '../../utils/logger';
import {
  SQS_MAX_RECEIVE_COUNT,
  SQS_RETRY_DELAY_SECONDS,
  SQS_VISIBILITY_TIMEOUT_SECONDS,
} from '../../config';

export interface JobContext {
  messageId?: string;
  /** 1 on first delivery. SQS counts every receive, including ones that crashed. */
  receiveCount: number;
  /**
   * True when a failure now moves the message to its DLQ instead of being
   * retried — handlers use it to record a terminal failure only once.
   */
  isFinalAttempt: boolean;
  metadata: EventMetadata;
}

export type JobHandler<T> = (payload: T, ctx: JobContext) => Promise<void>;

export interface ConsumeOptions {
  /** Jobs run at the same time. Also the receive batch size, so SQS caps it at 10. */
  concurrency?: number;
  /** Seconds a received message stays hidden from other workers. Renewed while the job runs. */
  visibilityTimeout?: number;
  /** Seconds before a failed job becomes visible again for a retry. */
  retryDelaySeconds?: number;
  /** The queue's redrive maxReceiveCount — only used to compute `isFinalAttempt`. */
  maxReceiveCount?: number;
  /** Long-poll wait. 20 (the SQS maximum) everywhere except tests. */
  waitTimeSeconds?: number;
  /** Pause after a failed receive call, so an outage doesn't spin the loop. */
  receiveErrorBackoffMs?: number;
}

export interface Consumer {
  queueName: string;
  /**
   * Stops polling and resolves once in-flight jobs have finished. Can take up
   * to one long poll (20s) longer: an open poll is never cancelled, because
   * SQS doesn't notice a cancelled request and could still hand it a message
   * that would then stay hidden, unprocessed, for a whole visibility timeout.
   */
  stop(): Promise<void>;
}

/**
 * Long-polls one queue and runs `handler` for each job.
 *
 * Message lifecycle:
 *   received   → hidden for `visibilityTimeout`, renewed every third of it while the job runs
 *   success    → deleted
 *   failure    → made visible again after `retryDelaySeconds`; once it has been received
 *                maxReceiveCount times, the queue's redrive policy moves it to the DLQ
 *   malformed  → logged and deleted (it can never succeed, so retrying is pointless)
 *   received while stopping → handed straight back (visibility 0) for another worker
 *
 * Standard queues deliver at least once, so handlers must be safe to run twice.
 */
export function consume<T>(
  queue: QueueDefinition,
  handler: JobHandler<T>,
  options: ConsumeOptions = {},
): Consumer {
  const {
    concurrency = 1,
    visibilityTimeout = SQS_VISIBILITY_TIMEOUT_SECONDS,
    retryDelaySeconds = SQS_RETRY_DELAY_SECONDS,
    maxReceiveCount = SQS_MAX_RECEIVE_COUNT,
    waitTimeSeconds = 20,
    receiveErrorBackoffMs = 5000,
  } = options;

  const queueUrl = requireQueueUrl(queue);
  const abort = new AbortController();
  // Receive only what can start right away. A message waiting behind another
  // job isn't renewed, so its timeout would run out and a second worker would
  // pick it up too.
  const batchSize = Math.max(1, Math.min(concurrency, 10));

  const loop = (async () => {
    while (!abort.signal.aborted) {
      let messages: Message[];
      try {
        const res = await sqsClient.send(
          new ReceiveMessageCommand({
            QueueUrl: queueUrl,
            MaxNumberOfMessages: batchSize,
            WaitTimeSeconds: waitTimeSeconds,
            VisibilityTimeout: visibilityTimeout,
            MessageSystemAttributeNames: ['ApproximateReceiveCount'],
            MessageAttributeNames: ['All'],
          }),
          // No abortSignal on purpose — see Consumer.stop().
        );
        messages = res.Messages ?? [];
      } catch (error) {
        logger.warn(`[SQS] Receive failed on ${queue.name}. Backing off.`, error);
        await sleep(receiveErrorBackoffMs, undefined, { signal: abort.signal }).catch(() => {});
        continue;
      }

      if (abort.signal.aborted) {
        await Promise.all(messages.map((m) => release(queueUrl, m)));
        break;
      }

      await Promise.all(
        messages.map((m) =>
          runOne(queue, queueUrl, m, handler, {
            visibilityTimeout,
            retryDelaySeconds,
            maxReceiveCount,
          }),
        ),
      );
    }
  })();

  logger.info(
    `[SQS] Consumer listening on ${queue.name} (concurrency ${batchSize}, visibility ${visibilityTimeout}s, retry delay ${retryDelaySeconds}s)`,
  );

  return {
    queueName: queue.name,
    stop: async () => {
      abort.abort();
      await loop;
      logger.info(`[SQS] Consumer on ${queue.name} stopped.`);
    },
  };
}

function release(queueUrl: string, m: Message): Promise<unknown> {
  return sqsClient
    .send(
      new ChangeMessageVisibilityCommand({
        QueueUrl: queueUrl,
        ReceiptHandle: m.ReceiptHandle!,
        VisibilityTimeout: 0,
      }),
    )
    .catch(() => {});
}

function parseEnvelope<T>(body: string | undefined): DomainEvent<T> | null {
  try {
    const parsed = JSON.parse(body ?? '');
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      !parsed.metadata ||
      typeof parsed.metadata !== 'object' ||
      !('payload' in parsed)
    ) {
      return null;
    }
    return parsed as DomainEvent<T>;
  } catch {
    return null;
  }
}

/** Never throws, so one bad message can't stop the loop. */
async function runOne<T>(
  queue: QueueDefinition,
  queueUrl: string,
  m: Message,
  handler: JobHandler<T>,
  settings: { visibilityTimeout: number; retryDelaySeconds: number; maxReceiveCount: number },
): Promise<void> {
  const receipt = { QueueUrl: queueUrl, ReceiptHandle: m.ReceiptHandle! };
  const receiveCount = Number(m.Attributes?.ApproximateReceiveCount ?? 1);

  const event = parseEnvelope<T>(m.Body);
  if (!event) {
    logger.error(
      `[SQS] Dropping malformed message on ${queue.name} [messageId:${m.MessageId}]: ${m.Body?.slice(0, 500)}`,
    );
    await sqsClient.send(new DeleteMessageCommand(receipt)).catch(() => {});
    return;
  }

  // Resume the logging context of the request that queued this job. Jobs
  // queued outside a request (the scheduler, scripts) fall back to the
  // eventId, so every retry of the same job still shares one correlationId.
  const correlationId =
    m.MessageAttributes?.correlationId?.StringValue ||
    event.metadata.correlationId ||
    event.metadata.eventId ||
    uuidv4();
  const requestId =
    m.MessageAttributes?.requestId?.StringValue || event.metadata.requestId || uuidv4();

  await asyncLocalStorage.run({ correlationId, requestId }, async () => {
    // Keep the message hidden while the job runs, or another worker picks it up mid-job.
    const heartbeat = setInterval(
      () => {
        sqsClient
          .send(
            new ChangeMessageVisibilityCommand({
              ...receipt,
              VisibilityTimeout: settings.visibilityTimeout,
            }),
          )
          .catch((error) =>
            logger.warn(`[SQS] Heartbeat failed on ${queue.name} [${m.MessageId}]`, error),
          );
      },
      Math.max(1000, (settings.visibilityTimeout * 1000) / 3),
    );

    const ctx: JobContext = {
      messageId: m.MessageId,
      receiveCount,
      isFinalAttempt: receiveCount >= settings.maxReceiveCount,
      metadata: event.metadata,
    };
    const startedAt = Date.now();

    try {
      await handler(event.payload, ctx);
      // Stop renewing before deleting, so a late heartbeat can't hit a gone receipt.
      clearInterval(heartbeat);
      await sqsClient.send(new DeleteMessageCommand(receipt));
      workerMetrics.recordJob({
        jobId: m.MessageId ?? event.metadata.eventId,
        jobType: queue.name,
        durationMs: Date.now() - startedAt,
        status: 'success',
      });
    } catch (error) {
      clearInterval(heartbeat);
      workerMetrics.recordJob({
        jobId: m.MessageId ?? event.metadata.eventId,
        jobType: queue.name,
        durationMs: Date.now() - startedAt,
        status: 'failed',
      });
      // Not deleted: SQS redelivers it after the retry delay, and the queue's
      // redrive policy moves it to the DLQ after maxReceiveCount receives.
      logger.error(
        ctx.isFinalAttempt
          ? `[SQS] Job failed on ${queue.name} (attempt ${receiveCount}/${settings.maxReceiveCount}) — moving to DLQ [eventId:${event.metadata.eventId}]`
          : `[SQS] Job failed on ${queue.name} (attempt ${receiveCount}/${settings.maxReceiveCount}) — retrying in ${settings.retryDelaySeconds}s [eventId:${event.metadata.eventId}]`,
        error,
      );
      await sqsClient
        .send(
          new ChangeMessageVisibilityCommand({
            ...receipt,
            VisibilityTimeout: settings.retryDelaySeconds,
          }),
        )
        .catch(() => {});
    }
  });
}
