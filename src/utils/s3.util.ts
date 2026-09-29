import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  PutBucketPolicyCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { AWS_REGION, AWS_S3_BUCKET, S3_ENDPOINT, S3_PUBLIC_URL } from '../config';
import { throwResponse } from './throw-response';
import logger from './logger';

const s3Client = new S3Client({
  region: AWS_REGION,
  // MinIO (and most S3-compatible servers) need a custom endpoint + path-style URLs.
  ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT, forcePathStyle: true } : {}),
});

// Only meaningful when S3_ENDPOINT is set — real AWS S3 already has its
// bucket created and its own access policy managed in the AWS console, and
// this must never try to touch that. Local dev's bucket doesn't survive a
// fresh `minio_data` volume, so this replaces what a one-shot minio-init/`mc`
// container used to do (see docker-compose.yml's `minio` service comment) —
// checked once per process lifetime rather than before every upload.
let localBucketReady = false;

async function ensureLocalBucketReady(): Promise<void> {
  if (!S3_ENDPOINT || localBucketReady) return;

  try {
    await s3Client.send(new CreateBucketCommand({ Bucket: AWS_S3_BUCKET }));
  } catch (error) {
    const code = (error as { name?: string })?.name;
    if (code !== 'BucketAlreadyOwnedByYou' && code !== 'BucketAlreadyExists') {
      logger.error('[s3.util:ensureLocalBucketReady] CreateBucket failed:', error);
    }
  }

  try {
    await s3Client.send(
      new PutBucketPolicyCommand({
        Bucket: AWS_S3_BUCKET,
        Policy: JSON.stringify({
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: '*',
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${AWS_S3_BUCKET}/*`],
            },
          ],
        }),
      }),
    );
  } catch (error) {
    logger.error('[s3.util:ensureLocalBucketReady] PutBucketPolicy failed:', error);
  }

  localBucketReady = true;
}

/** Public URL prefix for objects: MinIO path-style locally, virtual-hosted AWS otherwise. */
const OBJECT_URL_PREFIX = S3_ENDPOINT
  ? `${S3_PUBLIC_URL}/${AWS_S3_BUCKET}/`
  : `https://${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com/`;

const EXTENSION_BY_MIMETYPE: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

/** Lowercases and strips a string down to `[a-z0-9-]` for safe use inside an S3 key segment. */
function sanitizeKeySegment(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Object keys are `{folder}/{filenamePrefix-}{uuid}{ext}`. The uuid is what
 * actually guarantees uniqueness — `filenamePrefix` (e.g. a collection's
 * slug) is purely for human readability in the URL and is never relied on
 * for identity, since business identifiers like a slug can be edited after
 * the image is uploaded and would otherwise orphan the old object or require
 * rewriting it on every rename.
 */
export async function uploadToS3(params: {
  buffer: Buffer;
  mimetype: string;
  originalName: string;
  folder: string;
  filenamePrefix?: string;
}): Promise<string> {
  if (!AWS_S3_BUCKET) {
    throwResponse(500, 'S3 is not configured (AWS_S3_BUCKET_NAME is unset)');
  }

  await ensureLocalBucketReady();

  const ext =
    EXTENSION_BY_MIMETYPE[params.mimetype] ??
    (params.originalName.includes('.') ? `.${params.originalName.split('.').pop()}` : '');
  const prefix = params.filenamePrefix ? sanitizeKeySegment(params.filenamePrefix) : '';
  const key = `${params.folder}/${prefix ? `${prefix}-` : ''}${uuidv4()}${ext}`;

  await s3Client.send(
    new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      Body: params.buffer,
      ContentType: params.mimetype,
    }),
  );

  return `${OBJECT_URL_PREFIX}${key}`;
}

function keyOwnedByUs(url: string): string | null {
  const prefix = OBJECT_URL_PREFIX;
  // Never attempt to delete a URL we didn't generate ourselves — e.g. a
  // pasted external product-photo URL used as a collection cover.
  if (!AWS_S3_BUCKET || !url.startsWith(prefix)) return null;
  const key = url.slice(prefix.length);
  return key || null;
}

/**
 * Best-effort delete of a previously-uploaded object, keyed off the full URL
 * `uploadToS3` returned. Silently no-ops (rather than throwing) on a URL we
 * didn't generate, or once the object is already gone — the caller uses this
 * to clean up a replaced image, and a failure here shouldn't fail whatever
 * database write already succeeded.
 */
export async function deleteFromS3(url: string): Promise<void> {
  const key = keyOwnedByUs(url);
  if (!key) return;

  await s3Client.send(new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key }));
}
