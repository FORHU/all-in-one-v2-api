import { SQSClient } from '@aws-sdk/client-sqs';
import { AWS_REGION, AWS_SQS_ENDPOINT } from '../../config';

/**
 * One SQS client for the whole process. The endpoint override is spread in
 * only when AWS_SQS_ENDPOINT is set (LocalStack in local dev), so deployed
 * environments take the normal AWS path and credential chain.
 *
 * LocalStack accepts any credentials. When pointed at it with no keys in the
 * environment at all, fall back to dummy ones rather than fail the SDK's
 * credential lookup — real keys (e.g. the ones S3 uses) are kept when present.
 */
const useLocalDummyCredentials = Boolean(AWS_SQS_ENDPOINT) && !process.env.AWS_ACCESS_KEY_ID;

export const sqsClient = new SQSClient({
  region: AWS_REGION,
  ...(AWS_SQS_ENDPOINT ? { endpoint: AWS_SQS_ENDPOINT } : {}),
  ...(useLocalDummyCredentials
    ? { credentials: { accessKeyId: 'test', secretAccessKey: 'test' } }
    : {}),
});
