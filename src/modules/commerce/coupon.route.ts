import express from 'express';
import { createCoupon, listCoupons, validateCoupon } from './coupon.controller';

const router = express.Router();

router.post('/', createCoupon);
router.get('/', listCoupons);
router.get('/validate/:code', validateCoupon);

export default router;
