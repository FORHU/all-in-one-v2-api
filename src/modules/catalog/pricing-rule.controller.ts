import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import PricingRuleService from './pricing-rule.service';
import { responseSuccess } from '../../helpers/response.helper';

// Cross-field ordering (endsAt after startsAt) is validated in
// PricingRuleService, not here — keeps this schema's job to plain shape
// checking only.
const saleBodySchema = Joi.object({
  type: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').required(),
  value: Joi.number().min(0).required(),
  startsAt: Joi.string().isoDate().required(),
  endsAt: Joi.string().isoDate().required(),
});

const createBodySchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  markupValue: Joi.number().min(0).required(),
  minimumProfit: Joi.number().min(0).allow(null).optional(),
  sale: saleBodySchema.allow(null).optional(),
});

const updateBodySchema = createBodySchema.fork(['name', 'markupValue'], (s) => s.optional());

export default class PricingRuleController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const rules = await PricingRuleService.listRules();
      return responseSuccess(res, 200, { items: rules });
    } catch (err) {
      next(err);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    const { error, value } = createBodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    try {
      const rule = await PricingRuleService.createRule(value);
      return responseSuccess(res, 201, rule, 'Pricing rule created successfully');
    } catch (err) {
      next(err);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    const { error, value } = updateBodySchema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    try {
      const rule = await PricingRuleService.updateRule(req.params.id, value);
      return responseSuccess(res, 200, rule, 'Pricing rule updated successfully');
    } catch (err) {
      next(err);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await PricingRuleService.deleteRule(req.params.id);
      return responseSuccess(res, 200, null, 'Pricing rule deleted successfully');
    } catch (err) {
      next(err);
    }
  }

  static async applyToAll(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PricingRuleService.applyToAll(req.params.id);
      return responseSuccess(
        res,
        200,
        result,
        `Applied to ${result.updatedCount} product${result.updatedCount === 1 ? '' : 's'}`,
      );
    } catch (err) {
      next(err);
    }
  }
}
