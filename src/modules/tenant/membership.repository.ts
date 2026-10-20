import { TenantRole } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export default class MembershipRepository {
  static async listByTenant(tenantId: string) {
    return prisma.tenantMembership.findMany({
      where: { tenantId },
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Scoped by tenantId (not a bare findUnique(id)) so a membership id from a
  // different tenant can never be looked up through this module.
  static async findById(tenantId: string, id: string) {
    return prisma.tenantMembership.findFirst({
      where: { id, tenantId },
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
      },
    });
  }

  static async findByUserId(tenantId: string, userId: string) {
    return prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
  }

  static async create(tenantId: string, userId: string, role: TenantRole) {
    return prisma.tenantMembership.create({
      data: { tenantId, userId, role, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
      },
    });
  }

  static async updateRole(id: string, role: TenantRole) {
    return prisma.tenantMembership.update({
      where: { id },
      data: { role },
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
      },
    });
  }

  static async remove(id: string) {
    return prisma.tenantMembership.delete({ where: { id } });
  }

  static async countByTenantAndRole(tenantId: string, role: TenantRole) {
    return prisma.tenantMembership.count({ where: { tenantId, role } });
  }

  // Every membership row for one account, across every tenant — used by
  // GET /tenant-memberships/mine so a non-platform-admin can discover which
  // store(s) they belong to before any tenant context is known to be correct.
  static async listByUserId(userId: string) {
    return prisma.tenantMembership.findMany({
      where: { userId },
      include: { tenant: { select: { id: true, slug: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    });
  }

  // Every membership row, across every tenant — platform-admin-only surface
  // (GET /tenant-memberships/all), gated by the route, not here.
  static async listAll() {
    return prisma.tenantMembership.findMany({
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
        tenant: { select: { id: true, slug: true, name: true } },
      },
      orderBy: [{ tenant: { name: 'asc' } }, { createdAt: 'asc' }],
    });
  }

  // Unscoped lookup by id, with no tenantId filter — unlike findById() above,
  // this is NOT a safe general-purpose method. It exists solely so a platform
  // admin (already verified by the caller) can resolve which tenant an
  // arbitrary membership row belongs to before acting on it outside their own
  // ambient tenant. Never call this on behalf of a non-platform-admin caller.
  static async findByIdUnscoped(id: string) {
    return prisma.tenantMembership.findUnique({
      where: { id },
      include: {
        user: { select: { id: true, name: true, email: true, username: true } },
      },
    });
  }
}
