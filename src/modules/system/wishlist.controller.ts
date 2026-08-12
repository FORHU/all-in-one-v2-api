import { Request, Response, NextFunction } from 'express';
import WishlistService from './wishlist.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';

export const getWishlist = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as unknown as { user?: { id: string } }).user?.id; // Assuming auth middleware sets this
    if (!customerId) return responseError(res, 401, 'Unauthorized');
    const wishlist = await WishlistService.getWishlist(customerId);
    return responseSuccess(res, 200, wishlist);
  } catch (error) {
    next(error);
  }
};

export const addItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = (req as unknown as { user?: { id: string } }).user?.id;
    if (!customerId) return responseError(res, 401, 'Unauthorized');
    const { productVariantId } = req.body;
    const item = await WishlistService.addItem(customerId, productVariantId);
    return responseSuccess(res, 201, item);
  } catch (error) {
    next(error);
  }
};

export const removeItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { itemId } = req.params;
    await WishlistService.removeItem(itemId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
};
