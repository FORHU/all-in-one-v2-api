import { Request, Response, NextFunction } from 'express';
import PromotionService from '../services/promotion.service';
import { responseSuccess } from '../helpers/response.helper';
import { PromotionStatus } from '@prisma/client';

export default class PromotionController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as PromotionStatus | undefined;
      const promotions = await PromotionService.getPromotions(status);
      return responseSuccess(res, 200, promotions);
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
    try {
      const promotion = await PromotionService.createPromotion(req.body);
      return responseSuccess(res, 201, promotion, 'Promotion campaign created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const promotion = await PromotionService.updatePromotion(req.params.id, req.body);
      return responseSuccess(res, 200, promotion, 'Promotion campaign updated successfully');
    } catch (error) {
      next(error);
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
}
