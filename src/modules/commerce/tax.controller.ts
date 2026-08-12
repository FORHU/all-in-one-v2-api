import { Request, Response, NextFunction } from 'express';
import TaxService from './tax.service';
import { responseSuccess } from '../../helpers/response.helper';

export const createTaxClass = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taxClass = await TaxService.createTaxClass(req.body);
    return responseSuccess(res, 201, taxClass);
  } catch (error) {
    next(error);
  }
};

export const getTaxClasses = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const taxClasses = await TaxService.getTaxClasses();
    return responseSuccess(res, 200, taxClasses);
  } catch (error) {
    next(error);
  }
};
