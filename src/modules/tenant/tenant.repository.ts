import { Prisma, TenantStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export default class TenantRepository {
  static async findBySlug(slug: string) {
    return prisma.tenant.findUnique({ where: { slug } });
  }

  static async findByDomain(domain: string) {
    return prisma.tenant.findUnique({ where: { domain } });
  }

  static async findById(id: string) {
    return prisma.tenant.findUnique({ where: { id } });
  }

  static async listActive() {
    return prisma.tenant.findMany({
      where: { status: TenantStatus.ACTIVE },
      orderBy: { name: 'asc' },
    });
  }

  static async listAll() {
    return prisma.tenant.findMany({ orderBy: { createdAt: 'desc' } });
  }

  /**
   * Per-tenant product counts, keyed by tenantId. Tenant has no relation
   * loaded here on purpose — `Prisma.tenant.findMany({ include: { products
   * } })` would pull every product row across every store just to count
   * them; a groupBy only touches catalog_products and returns one row per
   * tenant.
   */
  static async getProductCounts(): Promise<Record<string, number>> {
    const grouped = await prisma.catalogProduct.groupBy({
      by: ['tenantId'],
      where: { deletedAt: null },
      _count: { tenantId: true },
    });

    return Object.fromEntries(
      grouped.map((g: { tenantId: string; _count: { tenantId: number } }) => [
        g.tenantId,
        g._count.tenantId,
      ]),
    );
  }

  static async create(data: Prisma.TenantCreateInput) {
    return prisma.tenant.create({ data });
  }

  static async update(id: string, data: Prisma.TenantUpdateInput) {
    return prisma.tenant.update({ where: { id }, data });
  }

  static async getMembership(tenantId: string, userId: string) {
    return prisma.tenantMembership.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
    });
  }
}
