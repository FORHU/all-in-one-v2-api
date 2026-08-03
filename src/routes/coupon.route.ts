import express from 'express';
import { createCoupon, listCoupons, validateCoupon } from '../controllers/coupon.controller';

const router = express.Router();

router.post('/', createCoupon);
router.get('/', listCoupons);
router.get('/validate/:code', validateCoupon);

export default router;
