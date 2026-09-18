import { Prisma } from '@prisma/client';

jest.mock('../../src/modules/promotion/promotion.repository', () => ({
  __esModule: true,
  default: { findActiveCandidates: jest.fn() },
}));
jest.mock('../../src/utils/logger', () => ({
  __esModule: true,
  default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() },
}));

import PromotionEngine, {
  PromotionContext,
  PromotionLineItem,
} from '../../src/modules/promotion/promotion.engine';
import PromotionRepository from '../../src/modules/promotion/promotion.repository';

const findCandidates = PromotionRepository.findActiveCandidates as jest.Mock;

const D = (n: number | string) => new Prisma.Decimal(n);

function line(overrides: Partial<PromotionLineItem> = {}): PromotionLineItem {
  return {
    productVariantId: 'v1',
    productId: 'p1',
    categoryId: null,
    collectionIds: [],
    quantity: 1,
    unitPrice: D(100),
    ...overrides,
  };
}

function promo(overrides: Record<string, unknown> = {}) {
  return {
    id: 'promo-1',
    tenantId: 't1',
    title: 'Test',
    code: null,
    description: null,
    status: 'ACTIVE',
    priority: 0,
    startDate: null,
    endDate: null,
    usageLimit: null,
    usageCount: 0,
    deletedAt: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    rules: [],
    rewards: [],
    targets: [],
    ...overrides,
  };
}

function ctx(overrides: Partial<PromotionContext> = {}): PromotionContext {
  const items = overrides.items ?? [line()];
  const subtotal =
    overrides.subtotal ?? items.reduce((a, i) => a.plus(i.unitPrice.times(i.quantity)), D(0));
  return {
    tenantId: 't1',
    items,
    subtotal,
    shippingAmount: D(0),
    isFirstOrder: false,
    code: null,
    ...overrides,
  };
}

beforeEach(() => jest.clearAllMocks());

describe('PromotionEngine.evaluate', () => {
  it('returns an empty evaluation when there are no candidates', async () => {
    findCandidates.mockResolvedValue([]);
    const res = await PromotionEngine.evaluate(ctx());
    expect(res.discountAmount.toNumber()).toBe(0);
    expect(res.applied).toEqual([]);
    expect(res.promotionId).toBeNull();
  });

  it('applies an automatic PERCENTAGE_OFF against the whole cart', async () => {
    findCandidates.mockResolvedValue([
      promo({ rewards: [{ id: 'r', rewardType: 'PERCENTAGE_OFF', value: 10, maxDiscount: null }] }),
    ]);
    const res = await PromotionEngine.evaluate(ctx({ items: [line({ quantity: 2 })] })); // subtotal 200
    expect(res.discountAmount.toNumber()).toBe(20);
    expect(res.promotionId).toBe('promo-1');
  });

  it('honours a reward maxDiscount cap', async () => {
    findCandidates.mockResolvedValue([
      promo({ rewards: [{ id: 'r', rewardType: 'PERCENTAGE_OFF', value: 50, maxDiscount: 30 }] }),
    ]);
    const res = await PromotionEngine.evaluate(ctx({ items: [line({ quantity: 2 })] })); // 50% of 200 = 100 -> capped 30
    expect(res.discountAmount.toNumber()).toBe(30);
  });

  it('skips a promo whose MIN_CART_TOTAL rule is not met', async () => {
    findCandidates.mockResolvedValue([
      promo({
        rules: [{ id: 'rule', ruleType: 'MIN_CART_TOTAL', condition: { minTotal: 500 } }],
        rewards: [{ id: 'r', rewardType: 'PERCENTAGE_OFF', value: 10, maxDiscount: null }],
      }),
    ]);
    const res = await PromotionEngine.evaluate(ctx()); // subtotal 100 < 500
    expect(res.applied).toEqual([]);
  });

  it('applies a promo whose MIN_CART_TOTAL rule is met', async () => {
    findCandidates.mockResolvedValue([
      promo({
        rules: [{ id: 'rule', ruleType: 'MIN_CART_TOTAL', condition: { minTotal: 100 } }],
        rewards: [{ id: 'r', rewardType: 'FIXED_AMOUNT_OFF', value: 15, maxDiscount: null }],
      }),
    ]);
    const res = await PromotionEngine.evaluate(ctx());
    expect(res.discountAmount.toNumber()).toBe(15);
  });

  it('respects FIRST_ORDER', async () => {
    findCandidates.mockResolvedValue([
      promo({
        rules: [{ id: 'rule', ruleType: 'FIRST_ORDER', condition: {} }],
        rewards: [{ id: 'r', rewardType: 'PERCENTAGE_OFF', value: 10, maxDiscount: null }],
      }),
    ]);
    expect((await PromotionEngine.evaluate(ctx({ isFirstOrder: false }))).applied).toEqual([]);
    expect(
      (await PromotionEngine.evaluate(ctx({ isFirstOrder: true }))).discountAmount.toNumber(),
    ).toBe(10);
  });

  it('only scopes the discount to targeted collection lines', async () => {
    findCandidates.mockResolvedValue([
      promo({
        targets: [{ id: 't', targetType: 'COLLECTION', targetId: 'col-1' }],
        rewards: [{ id: 'r', rewardType: 'PERCENTAGE_OFF', value: 10, maxDiscount: null }],
      }),
    ]);
    const res = await PromotionEngine.evaluate(
      ctx({
        items: [
          line({ productVariantId: 'a', collectionIds: ['col-1'], unitPrice: D(100) }),
          line({ productVariantId: 'b', collectionIds: ['col-9'], unitPrice: D(100) }),
        ],
      }),
    );
    expect(res.discountAmount.toNumber()).toBe(10); // 10% of the one in-collection line
  });

  it('caps FIXED_AMOUNT_OFF at the targeted subtotal', async () => {
    findCandidates.mockResolvedValue([
      promo({
        rewards: [{ id: 'r', rewardType: 'FIXED_AMOUNT_OFF', value: 999, maxDiscount: null }],
      }),
    ]);
    const res = await PromotionEngine.evaluate(ctx()); // subtotal 100
    expect(res.discountAmount.toNumber()).toBe(100);
  });

  it('stacks two promos but never discounts more than the subtotal', async () => {
    findCandidates.mockResolvedValue([
      promo({
        id: 'a',
        priority: 10,
        rewards: [{ id: 'r1', rewardType: 'PERCENTAGE_OFF', value: 80, maxDiscount: null }],
      }),
      promo({
        id: 'b',
        priority: 5,
        rewards: [{ id: 'r2', rewardType: 'PERCENTAGE_OFF', value: 80, maxDiscount: null }],
      }),
    ]);
    const res = await PromotionEngine.evaluate(ctx()); // subtotal 100
    expect(res.discountAmount.toNumber()).toBe(100);
    expect(res.applied).toHaveLength(2);
    expect(res.promotionId).toBe('a');
  });

  it('treats FREE_SHIPPING as a flag with no cash discount', async () => {
    findCandidates.mockResolvedValue([
      promo({ rewards: [{ id: 'r', rewardType: 'FREE_SHIPPING', value: 0, maxDiscount: null }] }),
    ]);
    const res = await PromotionEngine.evaluate(ctx());
    expect(res.discountAmount.toNumber()).toBe(0);
    expect(res.freeShipping).toBe(true);
    expect(res.promotionId).toBe('promo-1');
  });
});
