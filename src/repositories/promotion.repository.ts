import { Prisma, PromotionStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class PromotionRepository {
  /** Find all promotions for a tenant */
  static async findAll(tenantId: string, status?: PromotionStatus) {
    return prisma.promotion.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      include: {
        rules: true,
        rewards: true,
        targets: true,
      },
      orderBy: { priority: 'desc' },
    });
  }

  /** Find promotion by ID */
  static async findById(tenantId: string, id: string) {
    return prisma.promotion.findFirst({
      where: { id, tenantId },
      include: {
        rules: true,
        rewards: true,
        targets: true,
      },
    });
  }

  /** Find promotion by coupon code */
  static async findByCode(tenantId: string, code: string) {
    return prisma.promotion.findFirst({
      where: { tenantId, code, status: 'ACTIVE' },
      include: {
        rules: true,
        rewards: true,
        targets: true,
      },
    });
  }

  /** Create a promotion with rules, rewards, and targets */
  static async create(
    tenantId: string,
    data: {
      title: string;
      code?: string;
      description?: string;
      status?: PromotionStatus;
      priority?: number;
      startDate?: Date;
      endDate?: Date;
      usageLimit?: number;
      rules?: { ruleType: string; condition: Prisma.InputJsonValue }[];
      rewards?: { rewardType: string; value: number; maxDiscount?: number }[];
      targets?: { targetType: string; targetId?: string }[];
    },
  ) {
    const { rules, rewards, targets, ...promoData } = data;
    return prisma.promotion.create({
      data: {
        ...promoData,
        tenant: { connect: { id: tenantId } },
        rules: rules ? { createMany: { data: rules } } : undefined,
        rewards: rewards ? { createMany: { data: rewards } } : undefined,
        targets: targets ? { createMany: { data: targets } } : undefined,
      },
      include: {
        rules: true,
        rewards: true,
        targets: true,
      },
    });
  }

  /** Update promotion */
  static async update(id: string, data: Prisma.PromotionUpdateInput) {
    return prisma.promotion.update({
      where: { id },
      data,
      include: {
        rules: true,
        rewards: true,
        targets: true,
      },
    });
  }

  /** Delete promotion */
  static async delete(id: string) {
    return prisma.promotion.delete({
      where: { id },
    });
  }
}
