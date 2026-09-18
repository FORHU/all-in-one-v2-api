import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import CouponService from './coupon.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';

const createSchema = Joi.object({
  code: Joi.string().trim().min(1).max(60).required(),
  discountType: Joi.string().valid('PERCENTAGE', 'FIXED_AMOUNT').optional(),
  discountValue: Joi.number().min(0).required(),
  minOrderValue: Joi.number().min(0).allow(null).optional(),
  maxDiscount: Joi.number().min(0).allow(null).optional(),
  usageLimit: Joi.number().integer().min(1).allow(null).optional(),
  expiresAt: Joi.string().isoDate().allow(null).optional(),
  isActive: Joi.boolean().optional(),
});

const updateSchema = createSchema.fork(['code', 'discountValue'], (s) => s.optional());

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = createSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);
  try {
    const coupon = await CouponService.createCoupon(value);
    return responseSuccess(res, 201, coupon, 'Coupon created');
  } catch (err) {
    next(err);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = updateSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);
  try {
    const coupon = await CouponService.updateCoupon(req.params.id, value);
    return responseSuccess(res, 200, coupon, 'Coupon updated');
  } catch (err) {
    next(err);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await CouponService.deleteCoupon(req.params.id);
    return responseSuccess(res, 200, null, 'Coupon deleted');
  } catch (err) {
    next(err);
  }
};

export const listCoupons = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const coupons = await CouponService.listCoupons();
    return responseSuccess(res, 200, { items: coupons });
  } catch (error) {
    next(error);
  }
};

export const validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await CouponService.validateCoupon(req.params.code);
    return responseSuccess(res, 200, coupon);
  } catch (error) {
    next(error);
  }
};
