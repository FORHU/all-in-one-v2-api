import { GetQueueAttributesCommand } from '@aws-sdk/client-sqs';
import { sqsClient } from './client';
import { QUEUES } from './queues';
import { enqueue } from './publisher';
import { consume } from './consumer';

const READINESS_TIMEOUT_MS = 3000;

/**
 * True when every configured queue answers. SQS is plain HTTPS, so there's no
 * connection to hold open — readiness means "the queues exist and these
 * credentials can see them".
 */
const isReady = async (): Promise<boolean> => {
  const urls = Object.values(QUEUES).map((q) => q.url);
  if (urls.some((url) => !url)) return false;

  try {
    await Promise.all(
      urls.map((url) =>
        sqsClient.send(
          new GetQueueAttributesCommand({ QueueUrl: url, AttributeNames: ['QueueArn'] }),
          { abortSignal: AbortSignal.timeout(READINESS_TIMEOUT_MS) },
        ),
      ),
    );
    return true;
  } catch {
    return false;
  }
};

export { QUEUES } from './queues';
export type { JobContext, JobHandler, Consumer } from './consumer';

export const sqs = {
  enqueue,
  consume,
  isReady,
};
