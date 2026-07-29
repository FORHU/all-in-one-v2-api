import { TenantStatus, Prisma } from '@prisma/client';
import TenantRepository from '../repositories/tenant.repository';
import { throwResponse } from '../utils/throw-response';

/**
 * Slugs that can't be used as a vertical because they collide with
 * infrastructure hostnames once a tenant becomes `<slug>.example.com`.
 */
const RESERVED_SLUGS = new Set([
  'www',
  'api',
  'admin',
  'app',
  'cdn',
  'static',
  'assets',
  'mail',
  'smtp',
  'docs',
  'status',
  'staging',
]);

export default class TenantService {
  /** Public lookup — only ACTIVE verticals are visible to shoppers. */
  static async getPublicTenant(slug: string) {
    const tenant = await TenantRepository.findBySlug(slug);
    if (!tenant || tenant.status !== TenantStatus.ACTIVE) {
      return throwResponse(404, `Tenant '${slug}' not found`);
    }
    return tenant;
  }

  static async listPublicTenants() {
    return TenantRepository.listActive();
  }

  static async listAllTenants() {
    return TenantRepository.listAll();
  }

  static async createTenant(data: {
    name: string;
    slug: string;
    domain?: string;
    settings?: Prisma.InputJsonValue;
  }) {
    if (RESERVED_SLUGS.has(data.slug)) {
      return throwResponse(422, `Slug '${data.slug}' is reserved`);
    }

    if (await TenantRepository.findBySlug(data.slug)) {
      return throwResponse(409, `Slug '${data.slug}' is already taken`);
    }

    if (data.domain && (await TenantRepository.findByDomain(data.domain))) {
      return throwResponse(409, `Domain '${data.domain}' is already in use`);
    }

    return TenantRepository.create(data);
  }

  static async updateTenant(
    id: string,
    data: {
      name?: string;
      domain?: string;
      status?: TenantStatus;
      settings?: Prisma.InputJsonValue;
    },
  ) {
    const tenant = await TenantRepository.findById(id);
    if (!tenant) {
      return throwResponse(404, 'Tenant not found');
    }

    if (data.domain && data.domain !== tenant.domain) {
      const conflict = await TenantRepository.findByDomain(data.domain);
      if (conflict) return throwResponse(409, `Domain '${data.domain}' is already in use`);
    }

    return TenantRepository.update(id, data);
  }
}
