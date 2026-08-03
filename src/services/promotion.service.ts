import PromotionRepository from '../repositories/promotion.repository';
import { throwResponse } from '../utils/throw-response';
import { requireTenantId } from '../utils/async-context';
import { PromotionStatus, Prisma } from '@prisma/client';

export default class PromotionService {
  static async getPromotions(status?: PromotionStatus) {
    return PromotionRepository.findAll(requireTenantId(), status);
  }

  static async getPromotionById(id: string) {
    const promotion = await PromotionRepository.findById(requireTenantId(), id);
    if (!promotion) return throwResponse(404, 'Promotion campaign not found');
    return promotion;
  }

  static async getPromotionByCode(code: string) {
    const promotion = await PromotionRepository.findByCode(requireTenantId(), code);
    if (!promotion)
      return throwResponse(404, `Active promotion code '${code}' not found or expired`);
    return promotion;
  }

  static async createPromotion(data: {
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
  }) {
    return PromotionRepository.create(requireTenantId(), data);
  }

  static async updatePromotion(id: string, data: Prisma.PromotionUpdateInput) {
    const tenantId = requireTenantId();
    const existing = await PromotionRepository.findById(tenantId, id);
    if (!existing) return throwResponse(404, 'Promotion campaign not found');
    return PromotionRepository.update(id, data);
  }

  static async deletePromotion(id: string) {
    const tenantId = requireTenantId();
    const existing = await PromotionRepository.findById(tenantId, id);
    if (!existing) return throwResponse(404, 'Promotion campaign not found');
    return PromotionRepository.delete(id);
  }

  static async getPricingRules() {
    return PromotionRepository.getPricingRules(requireTenantId());
  }
}
