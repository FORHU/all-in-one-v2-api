import { deriveWebhookEventId } from '../../src/utils/webhook-identity';

describe('deriveWebhookEventId', () => {
  it('prefers the provider event id over hashing (PayMongo nests it under data.id)', () => {
    expect(
      deriveWebhookEventId({ data: { id: 'evt_abc123', attributes: { status: 'paid' } } }),
    ).toBe('evt_abc123');
  });

  it('falls back through the other shapes providers use', () => {
    expect(deriveWebhookEventId({ id: 'evt_top' })).toBe('evt_top');
    expect(deriveWebhookEventId({ event_id: 'evt_snake' })).toBe('evt_snake');
    expect(deriveWebhookEventId({ eventId: 'evt_camel' })).toBe('evt_camel');
  });

  it('is deterministic when a provider sends no event id', () => {
    // The whole point of the unique constraint is that a redelivery collides
    // with the original. A random fallback would satisfy the constraint and
    // silently let every retry through.
    const payload = { amount: 500, status: 'paid' };
    expect(deriveWebhookEventId(payload)).toBe(deriveWebhookEventId({ ...payload }));
    expect(deriveWebhookEventId(payload)).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('hashes identically regardless of JSON key order', () => {
    expect(deriveWebhookEventId({ a: 1, b: { c: 2, d: 3 } })).toBe(
      deriveWebhookEventId({ b: { d: 3, c: 2 }, a: 1 }),
    );
  });

  it('distinguishes genuinely different payloads', () => {
    expect(deriveWebhookEventId({ amount: 500 })).not.toBe(deriveWebhookEventId({ amount: 501 }));
  });

  it('ignores an empty or non-string id and hashes instead', () => {
    // An empty id would otherwise collapse every such event into one row.
    expect(deriveWebhookEventId({ id: '' })).toMatch(/^sha256:/);
    expect(deriveWebhookEventId({ id: 12345 })).toMatch(/^sha256:/);
  });

  it('handles payloads that are not objects', () => {
    expect(deriveWebhookEventId(null)).toMatch(/^sha256:/);
    expect(deriveWebhookEventId('raw-body')).toMatch(/^sha256:/);
  });
});
