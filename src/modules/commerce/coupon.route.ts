import express from 'express';
import {
  createCoupon,
  listCoupons,
  validateCoupon,
  updateCoupon,
  deleteCoupon,
} from './coupon.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Public storefront route — a shopper checking a code before checkout.
router.get('/validate/:code', validateCoupon);

// Admin management — same catalog:* permissions as pricing rules and promotions.
router.get('/', authenticate, requirePermission('catalog:read'), listCoupons);
router.post('/', authenticate, requirePermission('catalog:write'), createCoupon);
router.put('/:id', authenticate, requirePermission('catalog:write'), updateCoupon);
router.delete('/:id', authenticate, requirePermission('catalog:delete'), deleteCoupon);

export default router;
