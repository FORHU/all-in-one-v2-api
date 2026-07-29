import { Prisma, TenantStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';

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

  static async create(data: Prisma.TenantCreateInput) {
    return prisma.tenant.create({ data });
  }

  static async update(id: string, data: Prisma.TenantUpdateInput) {
    return prisma.tenant.update({ where: { id }, data });
  }
}
