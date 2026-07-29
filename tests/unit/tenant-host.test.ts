jest.mock('../../src/config', () => ({
  ROOT_DOMAIN: 'example.com',
  DEFAULT_TENANT_SLUG: '',
  REDIS_TTL_SECONDS: 3600,
}));

import { slugFromHost } from '../../src/middleware/tenant.middleware';

describe('slugFromHost', () => {
  it('extracts the vertical from a single-label subdomain', () => {
    expect(slugFromHost('fashion.example.com')).toBe('fashion');
    expect(slugFromHost('beauty.example.com')).toBe('beauty');
  });

  it('returns null for the apex domain', () => {
    expect(slugFromHost('example.com')).toBeNull();
  });

  it('returns null for a host under a different root domain', () => {
    // Otherwise "fashion.evil.com" would resolve to the fashion vertical.
    expect(slugFromHost('fashion.evil.com')).toBeNull();
    expect(slugFromHost('example.com.evil.com')).toBeNull();
  });

  it('returns null for nested subdomains', () => {
    expect(slugFromHost('a.b.example.com')).toBeNull();
  });

  it('returns null for an empty label', () => {
    expect(slugFromHost('.example.com')).toBeNull();
  });

  it('does not match a domain that merely ends with the root string', () => {
    // "notexample.com" ends with "example.com" as a substring but is a
    // different domain — the dot boundary is what makes this safe.
    expect(slugFromHost('notexample.com')).toBeNull();
  });
});
