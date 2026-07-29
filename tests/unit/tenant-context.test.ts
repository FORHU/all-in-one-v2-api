import {
  requireTenantId,
  getTenantId,
  runWithTenant,
  asyncLocalStorage,
} from '../../src/utils/async-context';

describe('tenant context', () => {
  describe('requireTenantId', () => {
    it('throws when there is no context at all', () => {
      expect(() => requireTenantId()).toThrow();
    });

    it('throws when a context exists but carries no tenant', () => {
      asyncLocalStorage.run({ requestId: 'r1', correlationId: 'c1' }, () => {
        expect(() => requireTenantId()).toThrow();
      });
    });

    it('rejects with a 400 rather than falling through unscoped', () => {
      // Fail-closed is the whole point: a missing tenant must never degrade
      // into a query that reads another vertical's data.
      try {
        requireTenantId();
        fail('expected requireTenantId to throw');
      } catch (err) {
        expect((err as { status: number }).status).toBe(400);
      }
    });

    it('returns the tenant when one is present', () => {
      asyncLocalStorage.run(
        { requestId: 'r1', correlationId: 'c1', tenantId: 'tenant-abc' },
        () => {
          expect(requireTenantId()).toBe('tenant-abc');
        },
      );
    });
  });

  describe('getTenantId', () => {
    it('is undefined outside any context', () => {
      expect(getTenantId()).toBeUndefined();
    });
  });

  describe('runWithTenant', () => {
    it('makes the tenant visible to the wrapped work', () => {
      const seen = runWithTenant('tenant-xyz', () => requireTenantId());
      expect(seen).toBe('tenant-xyz');
    });

    it('does not leak the tenant outside the callback', () => {
      runWithTenant('tenant-xyz', () => requireTenantId());
      expect(getTenantId()).toBeUndefined();
    });

    it('preserves correlation ids already in the store', () => {
      asyncLocalStorage.run({ requestId: 'r9', correlationId: 'c9' }, () => {
        runWithTenant('tenant-1', () => {
          expect(asyncLocalStorage.getStore()?.correlationId).toBe('c9');
          expect(requireTenantId()).toBe('tenant-1');
        });
      });
    });

    it('survives async work inside the callback', async () => {
      await runWithTenant('tenant-async', async () => {
        await new Promise((r) => setTimeout(r, 5));
        expect(requireTenantId()).toBe('tenant-async');
      });
    });
  });
});
