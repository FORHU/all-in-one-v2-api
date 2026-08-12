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
      where: { tenantId, code },
    });
  }

  static async listCoupons(tenantId: string) {
    return prisma.coupon.findMany({
      where: { tenantId },
    });
  }
}
