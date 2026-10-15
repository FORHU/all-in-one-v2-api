import { SendMessageCommand } from '@aws-sdk/client-sqs';
import { v4 as uuidv4 } from 'uuid';
import { sqsClient } from './client';
import { QueueDefinition, requireQueueUrl } from './queues';
import { getContext } from '../../utils/async-context';
import logger from '../../utils/logger';

export interface EventMetadata {
  eventId: string;
  eventType: string;
  correlationId?: string;
  requestId?: string;
  timestamp: string;
  version: string;
}

/** Message body shape — unchanged from the RabbitMQ era. */
export interface DomainEvent<T> {
  metadata: EventMetadata;
  payload: T;
}

/**
 * Sends a job to a queue, wrapped in the same `{ metadata, payload }`
 * envelope the RabbitMQ publisher used.
 *
 * The current correlationId/requestId from AsyncLocalStorage go both into the
 * envelope and into SQS message attributes, so the worker can resume the same
 * logging context as the HTTP request that queued the job.
 *
 * Unlike the old publisher this throws on failure instead of returning false:
 * callers decide whether a failed enqueue should fail their request.
 */
export const enqueue = async <T>(
  queue: QueueDefinition,
  eventType: string,
  payload: T,
  version = '1',
): Promise<string | undefined> => {
  const queueUrl = requireQueueUrl(queue);
  const ctx = getContext();

  const metadata: EventMetadata = {
    eventId: uuidv4(),
    eventType,
    correlationId: ctx?.correlationId || undefined,
    requestId: ctx?.requestId || undefined,
    timestamp: new Date().toISOString(),
    version,
  };

  const event: DomainEvent<T> = { metadata, payload };

  const stringAttribute = (value: string) => ({ DataType: 'String', StringValue: value });

  const res = await sqsClient.send(
    new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: JSON.stringify(event),
      MessageAttributes: {
        eventId: stringAttribute(metadata.eventId),
        eventType: stringAttribute(metadata.eventType),
        ...(metadata.correlationId
          ? { correlationId: stringAttribute(metadata.correlationId) }
          : {}),
        ...(metadata.requestId ? { requestId: stringAttribute(metadata.requestId) } : {}),
      },
    }),
  );

  logger.info(
    `[SQS] Enqueued ${eventType} on ${queue.name} [eventId:${metadata.eventId}, messageId:${res.MessageId}]`,
  );
  return res.MessageId;
};
