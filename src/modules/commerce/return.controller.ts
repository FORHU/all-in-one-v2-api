import { Request, Response, NextFunction } from 'express';
import { ReturnStatus } from '@prisma/client';
import ReturnService from './return.service';
import { responseSuccess } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';

/**
 * GET /api/v2/returns
 */
export const listReturns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, sortBy, sortOrder } = parsePagination(
      req.query as Record<string, unknown>,
    );
    const rawStatus = req.query.status as string | undefined;
    const status =
      rawStatus && (Object.values(ReturnStatus) as string[]).includes(rawStatus)
        ? (rawStatus as ReturnStatus)
        : undefined;

    const result = await ReturnService.listReturns(page, limit, search, sortBy, sortOrder, status);
    return responseSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
};

export const createReturn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const returnReq = await ReturnService.createReturn(req.body);
    return responseSuccess(res, 201, returnReq);
  } catch (error) {
    next(error);
  }
};

export const getReturnsByOrderId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const returns = await ReturnService.getReturnsByOrderId(orderId);
    return responseSuccess(res, 200, returns);
  } catch (error) {
    next(error);
  }
};

export const issueRefund = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { returnId } = req.params;
    const { orderId, amount } = req.body;
    const refund = await ReturnService.issueRefund(orderId, returnId, amount);
    return responseSuccess(res, 201, refund);
  } catch (error) {
    next(error);
  }
};
