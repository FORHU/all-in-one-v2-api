import { Request, Response, NextFunction } from 'express';
import { Tenant, TenantStatus, TenantRole, UserRole } from '@prisma/client';
import TenantRepository from '../modules/tenant/tenant.repository';
import CacheUtil from '../utils/cache.util';
import { asyncLocalStorage, getContext } from '../utils/async-context';
import { ROOT_DOMAIN, DEFAULT_TENANT_SLUG } from '../config';
import logger from '../utils/logger';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /**
       * Snapshot of the tenant resolveTenant found for this request, mirrored
       * onto `req` (not just AsyncLocalStorage). Stream-based middleware like
       * multer can lose AsyncLocalStorage continuity — see restoreTenantContext
       * below — so anything running after a stream-consuming middleware should
       * re-derive context from these rather than trust the store is still live.
       */
      tenantId?: string;
      tenantSlug?: string;
    }
  }
}

const PLATFORM_ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.DEVELOPER];

const CACHE_TTL_SECONDS = 300;

/**
 * Extracts the vertical's slug from a host like `fashion.example.com`.
 * Returns null for the apex domain itself or anything that doesn't match.
 */
export const slugFromHost = (host: string): string | null => {
  if (!host.endsWith(`.${ROOT_DOMAIN}`)) return null;

  const label = host.slice(0, -(ROOT_DOMAIN.length + 1));
  // Only a single leading label counts — "a.b.example.com" is not a vertical.
  return label && !label.includes('.') ? label : null;
};

const lookupBySlug = async (slug: string): Promise<Tenant | null> =>
  CacheUtil.remember(`tenant:slug:${slug}`, CACHE_TTL_SECONDS, () =>
    TenantRepository.findBySlug(slug),
  );

const lookupByDomain = async (domain: string): Promise<Tenant | null> =>
  CacheUtil.remember(`tenant:domain:${domain}`, CACHE_TTL_SECONDS, () =>
    TenantRepository.findByDomain(domain),
  );

/**
 * Resolves the vertical for the request, in order:
 *   1. subdomain            fashion.example.com
 *   2. custom domain        shop.myfashion.com
 *   3. x-tenant-slug header (tools, local dev, server-to-server)
 *   4. DEFAULT_TENANT_SLUG  (dev convenience; unset in production)
 *
 * The resolved id is written into AsyncLocalStorage so downstream services can
 * read it without threading it through every signature.
 */
export const resolveTenant = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const host = req.hostname?.toLowerCase() ?? '';
    const slug = slugFromHost(host);
    const headerSlug = (req.headers['x-tenant-slug'] as string | undefined)?.toLowerCase();

    let tenant: Tenant | null = null;
    if (slug) tenant = await lookupBySlug(slug);
    if (!tenant && host) tenant = await lookupByDomain(host);
    if (!tenant && headerSlug) tenant = await lookupBySlug(headerSlug);
    if (!tenant && DEFAULT_TENANT_SLUG) tenant = await lookupBySlug(DEFAULT_TENANT_SLUG);

    if (!tenant) {
      // Not fatal: unscoped routes (auth, health, tenant listing) still work.
      // Scoped queries fail later via requireTenantId().
      return next();
    }

    if (tenant.status !== TenantStatus.ACTIVE) {
      return res.status(403).json({ message: `Storefront '${tenant.slug}' is not available` });
    }

    res.setHeader('x-tenant-slug', tenant.slug);

    // Mirrored onto `req` itself, not just AsyncLocalStorage — a plain object
    // reference survives stream-based middleware (e.g. multer parsing a
    // multipart body) that can otherwise lose AsyncLocalStorage continuity.
    // See restoreTenantContext below.
    req.tenantId = tenant.id;
    req.tenantSlug = tenant.slug;

    // Never silently drop a successfully-resolved tenant just because the
    // correlation context wasn't there to merge into — that previously let a
    // request sail through resolveTenant with a real, active tenant found,
    // only to hard-fail downstream at requireTenantId() with a misleading
    // "No tenant resolved" error. Falls back to a fresh context instead.
    const ctx = getContext();
    if (!ctx) {
      logger.warn(
        `[TenantMiddleware] Resolved tenant '${tenant.slug}' but no request context was set — correlationMiddleware may not have run first.`,
      );
    }

    asyncLocalStorage.run(
      {
        requestId: ctx?.requestId ?? '',
        correlationId: ctx?.correlationId ?? '',
        tenantId: tenant.id,
        tenantSlug: tenant.slug,
      },
      () => next(),
    );
  } catch (error) {
    // Resolution failures must never take the request down. Health probes and
    // unscoped routes have to keep working when the database or cache is
    // unreachable — otherwise a transient outage gets a healthy container
    // killed. Anything that genuinely needs a tenant fails closed later, in
    // requireTenantId().
    logger.error('[TenantMiddleware] Failed to resolve tenant, continuing unscoped', error);
    next();
  }
};

/**
 * Re-enters the AsyncLocalStorage tenant context from the snapshot
 * `resolveTenant` left on `req` — needed on any route where a stream-based
 * middleware (multer's multipart parsing, most notably) sits between
 * `resolveTenant` and the handler, since that can silently drop the
 * AsyncLocalStorage context the same way a `runWithTenant`-less background
 * job would. Mount it immediately after that middleware, e.g.:
 *   `authenticate, requirePermission(...), upload.single('file'), restoreTenantContext, handler`
 * A no-op (just calls `next()`) when resolveTenant never found a tenant, so
 * unscoped routes using this middleware are unaffected.
 */
export const restoreTenantContext = (req: Request, _res: Response, next: NextFunction) => {
  if (!req.tenantId) return next();

  const ctx = getContext();
  asyncLocalStorage.run(
    {
      requestId: ctx?.requestId ?? '',
      correlationId: ctx?.correlationId ?? '',
      tenantId: req.tenantId,
      tenantSlug: req.tenantSlug,
    },
    () => next(),
  );
};

/**
 * Restricts a route to users with specific roles within the current tenant.
 * Global platform admins bypass this restriction.
 * Requires both `authenticate` and `resolveTenant` to run first.
 */
export const requireTenantRole =
  (...roles: TenantRole[]) =>
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        if (!req.user) {
          return res.status(401).json({ message: 'Authentication required' });
        }

        // Global platform admins can manage any tenant
        if (PLATFORM_ADMIN_ROLES.includes(req.user.role)) {
          return next();
        }

        const ctx = getContext();
        if (!ctx || !ctx.tenantId) {
          return res.status(400).json({ message: 'Tenant context required' });
        }

        const membership = await TenantRepository.getMembership(ctx.tenantId, req.user.id);

        if (!membership || !roles.includes(membership.role)) {
          return res.status(403).json({ message: 'Insufficient tenant permissions' });
        }

        next();
      } catch (error) {
        next(error);
      }
    };
