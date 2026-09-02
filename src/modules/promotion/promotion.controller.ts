import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import PromotionService from './promotion.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';
import { PromotionStatus } from '@prisma/client';

const ruleSchema = Joi.object({
  ruleType: Joi.string()
    .valid('MIN_CART_TOTAL', 'MIN_QUANTITY', 'CUSTOMER_GROUP', 'FIRST_ORDER')
    .required(),
  condition: Joi.object().default({}),
});

const rewardSchema = Joi.object({
  rewardType: Joi.string()
    .valid('PERCENTAGE_OFF', 'FIXED_AMOUNT_OFF', 'FREE_SHIPPING', 'BUY_X_GET_Y')
    .required(),
  value: Joi.number().min(0).required(),
  maxDiscount: Joi.number().min(0).allow(null).optional(),
});

const targetSchema = Joi.object({
  targetType: Joi.string().valid('ALL', 'PRODUCT', 'VARIANT', 'COLLECTION', 'CATEGORY').required(),
  // Required for everything except ALL — cross-checked below.
  targetId: Joi.string().allow(null).optional(),
}).custom((value, helpers) => {
  if (value.targetType !== 'ALL' && !value.targetId) {
    return helpers.error('any.custom', { message: `${value.targetType} target needs a targetId` });
  }
  return value;
}, 'targetId presence');

const createSchema = Joi.object({
  title: Joi.string().trim().min(1).max(200).required(),
  code: Joi.string().trim().min(1).max(60).allow(null).optional(),
  description: Joi.string().allow('', null).max(2000).optional(),
  status: Joi.string()
    .valid(...Object.values(PromotionStatus))
    .optional(),
  priority: Joi.number().integer().min(0).max(1000).optional(),
  startDate: Joi.string().isoDate().allow(null).optional(),
  endDate: Joi.string().isoDate().allow(null).optional(),
  usageLimit: Joi.number().integer().min(1).allow(null).optional(),
  rules: Joi.array().items(ruleSchema).optional(),
  rewards: Joi.array().items(rewardSchema).min(1).optional(),
  targets: Joi.array().items(targetSchema).optional(),
});

const updateSchema = createSchema.fork(['title'], (s) => s.optional());

export default class PromotionController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const raw = req.query.status as string | undefined;
      const status =
        raw && (Object.values(PromotionStatus) as string[]).includes(raw)
          ? (raw as PromotionStatus)
          : undefined;
      const { page, limit } = parsePagination(req.query as Record<string, unknown>);
      const result = await PromotionService.getPromotions({ status, page, limit });
      return responseSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const promotion = await PromotionService.getPromotionById(req.params.id);
      return responseSuccess(res, 200, promotion);
    } catch (error) {
      next(error);
    }
  }

  static async getByCode(req: Request, res: Response, next: NextFunction) {
    try {
      const promotion = await PromotionService.getPromotionByCode(req.params.code);
      return responseSuccess(res, 200, promotion);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    const { error, value } = createSchema.validate(req.body);
    if (error) return responseError(res, 400, error.message);
    try {
      const promotion = await PromotionService.createPromotion(value);
      return responseSuccess(res, 201, promotion, 'Promotion campaign created successfully');
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    const { error, value } = updateSchema.validate(req.body);
    if (error) return responseError(res, 400, error.message);
    try {
      const promotion = await PromotionService.updatePromotion(req.params.id, value);
      return responseSuccess(res, 200, promotion, 'Promotion campaign updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await PromotionService.deletePromotion(req.params.id);
      return responseSuccess(res, 200, null, 'Promotion campaign deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getPricingRules(req: Request, res: Response, next: NextFunction) {
    try {
      const rules = await PromotionService.getPricingRules();
      return responseSuccess(res, 200, rules);
    } catch (error) {
      next(error);
    }
  }
}
