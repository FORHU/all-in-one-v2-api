import { Prisma, PromotionStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';

const withRelations = {
  rules: true,
  rewards: true,
  targets: true,
} satisfies Prisma.PromotionInclude;

export interface PromotionChildInput {
  rules?: { ruleType: string; condition: Prisma.InputJsonValue }[];
  rewards?: { rewardType: string; value: number; maxDiscount?: number | null }[];
  targets?: { targetType: string; targetId?: string | null }[];
}

export interface PromotionScalarInput {
  title?: string;
  code?: string | null;
  description?: string | null;
  status?: PromotionStatus;
  priority?: number;
  startDate?: Date | null;
  endDate?: Date | null;
  usageLimit?: number | null;
}

export type PromotionCreateInput = PromotionScalarInput & PromotionChildInput & { title: string };
export type PromotionUpdateInput = PromotionScalarInput & PromotionChildInput;

export default class PromotionRepository {
  static async findPage(
    tenantId: string,
    opts: { status?: PromotionStatus; skip: number; take: number },
  ) {
    const where: Prisma.PromotionWhereInput = {
      tenantId,
      deletedAt: null,
      ...(opts.status ? { status: opts.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        include: withRelations,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: opts.skip,
        take: opts.take,
      }),
      prisma.promotion.count({ where }),
    ]);
    return { items, total };
  }

  static async findById(tenantId: string, id: string) {
    return prisma.promotion.findFirst({
      where: { id, tenantId, deletedAt: null },
      include: withRelations,
    });
  }

  static async findByCode(tenantId: string, code: string) {
    return prisma.promotion.findFirst({
      where: {
        tenantId,
        code: { equals: code, mode: 'insensitive' },
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: withRelations,
    });
  }

  /**
   * Live promotions eligible to be applied to a checkout right now:
   * ACTIVE, inside their date window, under their usage cap. Automatic
   * promotions (no code) are always candidates; coded ones only when the
   * shopper supplied that exact code (case-insensitive).
   */
  static async findActiveCandidates(tenantId: string, code?: string) {
    const now = new Date();
    return prisma.promotion.findMany({
      where: {
        tenantId,
        deletedAt: null,
        status: 'ACTIVE',
        AND: [
          { OR: [{ startDate: null }, { startDate: { lte: now } }] },
          { OR: [{ endDate: null }, { endDate: { gte: now } }] },
          {
            OR: [{ usageLimit: null }, { usageCount: { lt: prisma.promotion.fields.usageLimit } }],
          },
        ],
        OR: code
          ? [{ code: null }, { code: { equals: code, mode: 'insensitive' } }]
          : [{ code: null }],
      },
      include: withRelations,
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });
  }

  static async create(tenantId: string, data: PromotionCreateInput) {
    const { rules, rewards, targets, ...promo } = data;
    return prisma.promotion.create({
      data: {
        ...promo,
        tenant: { connect: { id: tenantId } },
        rules: rules?.length ? { createMany: { data: rules } } : undefined,
        rewards: rewards?.length
          ? {
              createMany: {
                data: rewards.map((r) => ({ ...r, maxDiscount: r.maxDiscount ?? null })),
              },
            }
          : undefined,
        targets: targets?.length
          ? { createMany: { data: targets.map((t) => ({ ...t, targetId: t.targetId ?? null })) } }
          : undefined,
      },
      include: withRelations,
    });
  }

  /**
   * Scalar fields are patched in place. Whenever `rules`, `rewards` or
   * `targets` is present it is a full replacement of that child set — the old
   * rows are dropped and the new ones created, so the caller always sends the
   * complete list, never a delta.
   */
  static async update(id: string, data: PromotionUpdateInput) {
    const { rules, rewards, targets, ...scalar } = data;

    return prisma.$transaction(async (tx) => {
      if (rules !== undefined) {
        await tx.promotionRule.deleteMany({ where: { promotionId: id } });
        if (rules.length) {
          await tx.promotionRule.createMany({
            data: rules.map((r) => ({ ...r, promotionId: id })),
          });
        }
      }
      if (rewards !== undefined) {
        await tx.promotionReward.deleteMany({ where: { promotionId: id } });
        if (rewards.length) {
          await tx.promotionReward.createMany({
            data: rewards.map((r) => ({
              ...r,
              maxDiscount: r.maxDiscount ?? null,
              promotionId: id,
            })),
          });
        }
      }
      if (targets !== undefined) {
        await tx.promotionTarget.deleteMany({ where: { promotionId: id } });
        if (targets.length) {
          await tx.promotionTarget.createMany({
            data: targets.map((t) => ({ ...t, targetId: t.targetId ?? null, promotionId: id })),
          });
        }
      }
      return tx.promotion.update({ where: { id }, data: scalar, include: withRelations });
    });
  }

  /** Soft delete — keeps the row so historical orders keep resolving `promotion`. */
  static async softDelete(id: string) {
    return prisma.promotion.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'DISABLED' },
    });
  }

  /** Bump `usageCount` for every promotion an order consumed, inside that order's transaction. */
  static async incrementUsage(ids: string[], tx: Prisma.TransactionClient) {
    if (ids.length === 0) return;
    await tx.promotion.updateMany({
      where: { id: { in: ids } },
      data: { usageCount: { increment: 1 } },
    });
  }

  static async getPricingRules(tenantId: string) {
    return prisma.catalogPricingRule.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
