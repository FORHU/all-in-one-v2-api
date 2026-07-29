import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  requestId: string;
  correlationId: string;
  /** The vertical this request belongs to. Absent only before tenant resolution. */
  tenantId?: string;
  tenantSlug?: string;
}

export const asyncLocalStorage = new AsyncLocalStorage<RequestContext>();

export const getContext = (): RequestContext | undefined => {
  return asyncLocalStorage.getStore();
};

export const getCorrelationId = (): string | undefined => {
  return asyncLocalStorage.getStore()?.correlationId;
};

export const getRequestId = (): string | undefined => {
  return asyncLocalStorage.getStore()?.requestId;
};

export const getTenantId = (): string | undefined => {
  return asyncLocalStorage.getStore()?.tenantId;
};

/**
 * The active tenant, or a hard failure.
 *
 * Every scoped query goes through this. Missing tenant context is a bug — a
 * background job that forgot to re-enter the store, or a route mounted without
 * the tenant middleware — and must never silently degrade into an unscoped
 * query that reads another vertical's data.
 */
export const requireTenantId = (): string => {
  const tenantId = asyncLocalStorage.getStore()?.tenantId;
  if (!tenantId) {
    throw { status: 400, message: 'No tenant resolved for this request' };
  }
  return tenantId;
};

/** Runs `fn` with tenant context attached — used by workers and consumers. */
export const runWithTenant = <T>(tenantId: string, fn: () => T): T => {
  const current = asyncLocalStorage.getStore();
  return asyncLocalStorage.run(
    {
      ...current,
      requestId: current?.requestId ?? '',
      correlationId: current?.correlationId ?? '',
      tenantId,
    },
    fn,
  );
};
