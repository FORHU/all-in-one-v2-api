import express from 'express';
import { createReview, getProductReviews } from './review.controller';

const router = express.Router();

router.post('/', createReview);
router.get('/products/:productId', getProductReviews);

export default router;
