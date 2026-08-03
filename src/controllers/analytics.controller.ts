import { Request, Response, NextFunction } from 'express';
import AnalyticsService from '../services/analytics.service';
import { responseSuccess } from '../helpers/response.helper';

export const getDailySales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { startDate, endDate } = req.query;
    const sales = await AnalyticsService.getDailySales(startDate as string, endDate as string);
    return responseSuccess(res, 200, sales);
  } catch (error) {
    next(error);
  }
};

export const getTopProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const products = await AnalyticsService.getTopProducts();
    return responseSuccess(res, 200, products);
  } catch (error) {
    next(error);
  }
};

export const getCategorySales = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sales = await AnalyticsService.getCategorySales();
    return responseSuccess(res, 200, sales);
  } catch (error) {
    next(error);
  }
};

export const getSupplierAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analytics = await AnalyticsService.getSupplierAnalytics();
    return responseSuccess(res, 200, analytics);
  } catch (error) {
    next(error);
  }
};

export const getCustomerAnalytics = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const analytics = await AnalyticsService.getCustomerAnalytics();
    return responseSuccess(res, 200, analytics);
  } catch (error) {
    next(error);
  }
};
