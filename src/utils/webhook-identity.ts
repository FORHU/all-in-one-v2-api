import { createHash } from 'crypto';

/**
 * Fields providers commonly use to carry their own event identifier, in the
 * order we prefer them. PayMongo nests it under `data.id`; most others put an
 * id at the top level.
 */
const IDENTITY_PATHS: string[][] = [
  ['data', 'id'],
  ['id'],
  ['event_id'],
  ['eventId'],
  ['data', 'object', 'id'],
];

function readPath(payload: unknown, path: string[]): string | undefined {
  let cursor: unknown = payload;
  for (const key of path) {
    if (typeof cursor !== 'object' || cursor === null) return undefined;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.length > 0 ? cursor : undefined;
}

/**
 * Serialises with object keys sorted at every level, so two deliveries of the
 * same event hash identically even if the provider reorders JSON keys.
 */
function canonicalise(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(canonicalise).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${JSON.stringify(k)}:${canonicalise(v)}`);
  return `{${entries.join(',')}}`;
}

/**
 * Derives the stable identifier used to deduplicate webhook deliveries.
 *
 * Prefers the provider's own event ID. When a provider sends none, falls back to
 * a hash of the payload — deliberately deterministic, because a random value here
 * would satisfy the unique constraint while silently defeating its entire purpose.
 *
 * The trade-off of the hash fallback: two genuinely distinct events with byte-identical
 * payloads collapse into one. That is the safe direction to err for payment webhooks,
 * and providers worth integrating with all send event IDs.
 */
export function deriveWebhookEventId(payload: unknown): string {
  for (const path of IDENTITY_PATHS) {
    const found = readPath(payload, path);
    if (found) return found;
  }
  return `sha256:${createHash('sha256').update(canonicalise(payload)).digest('hex')}`;
}
