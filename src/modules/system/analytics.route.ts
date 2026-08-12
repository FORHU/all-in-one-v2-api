import express from 'express';
import {
  getDailySales,
  getTopProducts,
  getCategorySales,
  getSupplierAnalytics,
  getCustomerAnalytics,
} from './analytics.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../../middleware/auth.middleware';

const router = express.Router();

router.get('/daily', authenticate, authorize(...ADMIN_ROLES), getDailySales);
router.get('/top-products', authenticate, authorize(...ADMIN_ROLES), getTopProducts);
router.get('/categories', authenticate, authorize(...ADMIN_ROLES), getCategorySales);
router.get('/suppliers', authenticate, authorize(...ADMIN_ROLES), getSupplierAnalytics);
router.get('/customers', authenticate, authorize(...ADMIN_ROLES), getCustomerAnalytics);

export default router;
