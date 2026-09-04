import PromotionRepository, {
  PromotionCreateInput,
  PromotionUpdateInput,
} from './promotion.repository';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';
import { buildPage, PageResult } from '../../helpers/pagination.helper';
import { PromotionStatus, Prisma } from '@prisma/client';

type PromotionRow = NonNullable<Awaited<ReturnType<typeof PromotionRepository.findById>>>;

export interface PromotionRuleDto {
  id: string;
  ruleType: string;
  condition: Prisma.JsonValue;
}
export interface PromotionRewardDto {
  id: string;
  rewardType: string;
  value: number;
  maxDiscount: number | null;
}
export interface PromotionTargetDto {
  id: string;
  targetType: string;
  targetId: string | null;
}
export interface PromotionDto {
  id: string;
  title: string;
  code: string | null;
  description: string | null;
  status: PromotionStatus;
  priority: number;
  startDate: string | null;
  endDate: string | null;
  usageLimit: number | null;
  usageCount: number;
  rules: PromotionRuleDto[];
  rewards: PromotionRewardDto[];
  targets: PromotionTargetDto[];
  createdAt: string;
  updatedAt: string;
}

function toDto(row: PromotionRow): PromotionDto {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    description: row.description,
    status: row.status,
    priority: row.priority,
    startDate: row.startDate ? row.startDate.toISOString() : null,
    endDate: row.endDate ? row.endDate.toISOString() : null,
    usageLimit: row.usageLimit,
    usageCount: row.usageCount,
    rules: row.rules.map((r) => ({ id: r.id, ruleType: r.ruleType, condition: r.condition })),
    rewards: row.rewards.map((r) => ({
      id: r.id,
      rewardType: r.rewardType,
      value: r.value.toNumber(),
      maxDiscount: r.maxDiscount ? r.maxDiscount.toNumber() : null,
    })),
    targets: row.targets.map((t) => ({
      id: t.id,
      targetType: t.targetType,
      targetId: t.targetId,
    })),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** ISO strings in, `Date | null` out. Throws on a malformed date or an inverted window. */
function resolveWindow(
  startDate?: string | null,
  endDate?: string | null,
): { startDate?: Date | null; endDate?: Date | null } {
  const out: { startDate?: Date | null; endDate?: Date | null } = {};
  let start: Date | null = null;
  let end: Date | null = null;

  if (startDate !== undefined) {
    start = startDate ? new Date(startDate) : null;
    if (start && Number.isNaN(start.getTime()))
      return throwResponse(400, 'startDate is not a valid date');
    out.startDate = start;
  }
  if (endDate !== undefined) {
    end = endDate ? new Date(endDate) : null;
    if (end && Number.isNaN(end.getTime()))
      return throwResponse(400, 'endDate is not a valid date');
    out.endDate = end;
  }
  if (start && end && end.getTime() <= start.getTime()) {
    return throwResponse(400, 'endDate must be after startDate');
  }
  return out;
}

export interface PromotionWriteBody {
  title?: string;
  code?: string | null;
  description?: string | null;
  status?: PromotionStatus;
  priority?: number;
  startDate?: string | null;
  endDate?: string | null;
  usageLimit?: number | null;
  rules?: { ruleType: string; condition: Prisma.InputJsonValue }[];
  rewards?: { rewardType: string; value: number; maxDiscount?: number | null }[];
  targets?: { targetType: string; targetId?: string | null }[];
}

export default class PromotionService {
  static async getPromotions(opts: {
    status?: PromotionStatus;
    page: number;
    limit: number;
  }): Promise<PageResult<PromotionDto>> {
    const { items, total } = await PromotionRepository.findPage(requireTenantId(), {
      status: opts.status,
      skip: (opts.page - 1) * opts.limit,
      take: opts.limit,
    });
    return buildPage(items.map(toDto), total, { page: opts.page, limit: opts.limit });
  }

  static async getPromotionById(id: string): Promise<PromotionDto> {
    const row = await PromotionRepository.findById(requireTenantId(), id);
    if (!row) return throwResponse(404, 'Promotion campaign not found');
    return toDto(row);
  }

  static async getPromotionByCode(code: string): Promise<PromotionDto> {
    const row = await PromotionRepository.findByCode(requireTenantId(), code);
    if (!row) return throwResponse(404, `Active promotion code '${code}' not found or expired`);
    return toDto(row);
  }

  static async createPromotion(body: PromotionWriteBody): Promise<PromotionDto> {
    const tenantId = requireTenantId();
    if (!body.title || !body.title.trim()) return throwResponse(400, 'title is required');

    const window = resolveWindow(body.startDate, body.endDate);

    if (body.code) {
      const clash = await PromotionRepository.findByCode(tenantId, body.code.trim());
      if (clash)
        return throwResponse(400, `Promotion code "${body.code.trim()}" is already in use`);
    }

    const input: PromotionCreateInput = {
      title: body.title.trim(),
      code: body.code?.trim() || null,
      description: body.description ?? null,
      status: body.status,
      priority: body.priority,
      usageLimit: body.usageLimit ?? null,
      ...window,
      rules: body.rules,
      rewards: body.rewards,
      targets: body.targets,
    };

    const row = await PromotionRepository.create(tenantId, input);
    return toDto(row as PromotionRow);
  }

  static async updatePromotion(id: string, body: PromotionWriteBody): Promise<PromotionDto> {
    const tenantId = requireTenantId();
    const existing = await PromotionRepository.findById(tenantId, id);
    if (!existing) return throwResponse(404, 'Promotion campaign not found');

    const window = resolveWindow(body.startDate, body.endDate);

    if (
      body.code &&
      body.code.trim() &&
      body.code.trim().toLowerCase() !== (existing.code ?? '').toLowerCase()
    ) {
      const clash = await PromotionRepository.findByCode(tenantId, body.code.trim());
      if (clash && clash.id !== id) {
        return throwResponse(400, `Promotion code "${body.code.trim()}" is already in use`);
      }
    }

    const input: PromotionUpdateInput = {
      ...(body.title !== undefined && { title: body.title.trim() }),
      ...(body.code !== undefined && { code: body.code?.trim() || null }),
      ...(body.description !== undefined && { description: body.description ?? null }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.priority !== undefined && { priority: body.priority }),
      ...(body.usageLimit !== undefined && { usageLimit: body.usageLimit ?? null }),
      ...window,
      ...(body.rules !== undefined && { rules: body.rules }),
      ...(body.rewards !== undefined && { rewards: body.rewards }),
      ...(body.targets !== undefined && { targets: body.targets }),
    };

    const row = await PromotionRepository.update(id, input);
    return toDto(row as PromotionRow);
  }

  static async deletePromotion(id: string) {
    const tenantId = requireTenantId();
    const existing = await PromotionRepository.findById(tenantId, id);
    if (!existing) return throwResponse(404, 'Promotion campaign not found');
    await PromotionRepository.softDelete(id);
  }

  static async getPricingRules() {
    return PromotionRepository.getPricingRules(requireTenantId());
  }
}
