jest.mock('../../src/config', () => ({
  ROOT_DOMAIN: 'example.com',
  DEFAULT_TENANT_SLUG: '',
  REDIS_TTL_SECONDS: 3600,
}));

import type { Tenant } from '@prisma/client';
import { findTenant } from '../../src/middleware/tenant.middleware';

const tenant = (slug: string) => ({ id: `id-${slug}`, slug }) as Tenant;

// Mirrors the dev database: fashion's custom domain is the API's own host.
const tenantsBySlug: Record<string, Tenant> = {
  fashion: tenant('fashion'),
  beauty: tenant('beauty'),
  electronics: tenant('electronics'),
};
const tenantsByDomain: Record<string, Tenant> = {
  'dev.addictstyle.com': tenantsBySlug.fashion,
};

const bySlug = jest.fn(async (slug: string) => tenantsBySlug[slug] ?? null);
const byDomain = jest.fn(async (domain: string) => tenantsByDomain[domain] ?? null);

const resolve = (args: { headerSlug?: string; host: string; defaultSlug?: string }) =>
  findTenant({ ...args, bySlug, byDomain });

beforeEach(() => jest.clearAllMocks());

describe('findTenant', () => {
  it('prefers a valid x-tenant-slug header over the host', async () => {
    // The dev bug: every storefront calls the API at dev.addictstyle.com,
    // fashion's domain — DigitFriend's header must still win.
    const result = await resolve({ headerSlug: 'electronics', host: 'dev.addictstyle.com' });

    expect(result?.slug).toBe('electronics');
    expect(byDomain).not.toHaveBeenCalled();
  });

  it('prefers the header over a tenant subdomain too', async () => {
    const result = await resolve({ headerSlug: 'beauty', host: 'fashion.example.com' });
    expect(result?.slug).toBe('beauty');
  });

  it('falls back to the host when the header names no tenant', async () => {
    const result = await resolve({ headerSlug: 'nope', host: 'dev.addictstyle.com' });
    expect(result?.slug).toBe('fashion');
  });

  it('uses the subdomain, then the custom domain, when there is no header', async () => {
    expect((await resolve({ host: 'beauty.example.com' }))?.slug).toBe('beauty');
    expect((await resolve({ host: 'dev.addictstyle.com' }))?.slug).toBe('fashion');
  });

  it('uses the default slug only when nothing else resolves', async () => {
    expect((await resolve({ host: 'api.unknown.net', defaultSlug: 'fashion' }))?.slug).toBe(
      'fashion',
    );
    expect(
      (await resolve({ headerSlug: 'beauty', host: 'api.unknown.net', defaultSlug: 'fashion' }))
        ?.slug,
    ).toBe('beauty');
  });

  it('returns null when nothing resolves and there is no default', async () => {
    expect(await resolve({ host: 'api.unknown.net' })).toBeNull();
  });
});
