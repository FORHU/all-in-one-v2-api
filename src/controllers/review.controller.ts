import { Request, Response, NextFunction } from 'express';
import ReviewService from '../services/review.service';
import { responseSuccess } from '../helpers/response.helper';

export const createReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const review = await ReviewService.createReview(req.body);
    return responseSuccess(res, 201, review);
  } catch (error) {
    next(error);
  }
};

export const getProductReviews = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { productId } = req.params;
    const reviews = await ReviewService.getProductReviews(productId);
    return responseSuccess(res, 200, reviews);
  } catch (error) {
    next(error);
  }
};
