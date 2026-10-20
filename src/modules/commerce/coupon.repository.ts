import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export default class CouponRepository {
  static async createCoupon(tenantId: string, data: Omit<Prisma.CouponCreateInput, 'tenant'>) {
    return prisma.coupon.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  static async findByCode(tenantId: string, code: string) {
    return prisma.coupon.findFirst({
      where: { tenantId, code, deletedAt: null },
    });
  }

  static async findById(tenantId: string, id: string) {
    return prisma.coupon.findFirst({ where: { id, tenantId, deletedAt: null } });
  }

  static async listCoupons(tenantId: string) {
    return prisma.coupon.findMany({
      where: { tenantId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async updateCoupon(id: string, data: Prisma.CouponUpdateInput) {
    return prisma.coupon.update({ where: { id }, data });
  }

  /** Soft delete so historical orders keep resolving their `coupon`. */
  static async softDelete(id: string) {
    return prisma.coupon.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  static async incrementUsage(id: string, tx: Prisma.TransactionClient) {
    await tx.coupon.update({ where: { id }, data: { usageCount: { increment: 1 } } });
  }
}
