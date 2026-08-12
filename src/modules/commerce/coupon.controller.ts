import { Request, Response, NextFunction } from 'express';
import CouponService from './coupon.service';
import { responseSuccess } from '../../helpers/response.helper';

export const createCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupon = await CouponService.createCoupon(req.body);
    return responseSuccess(res, 201, coupon);
  } catch (error) {
    next(error);
  }
};

export const listCoupons = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const coupons = await CouponService.listCoupons();
    return responseSuccess(res, 200, coupons);
  } catch (error) {
    next(error);
  }
};

export const validateCoupon = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.params;
    const coupon = await CouponService.validateCoupon(code);
    return responseSuccess(res, 200, coupon);
  } catch (error) {
    next(error);
  }
};
