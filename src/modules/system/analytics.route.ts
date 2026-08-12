import express from 'express';
import {
  getDailySales,
  getTopProducts,
  getCategorySales,
  getSupplierAnalytics,
  getCustomerAnalytics,
} from './analytics.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

router.get('/daily', authenticate, requirePermission('analytics:read'), getDailySales);
router.get('/top-products', authenticate, requirePermission('analytics:read'), getTopProducts);
router.get('/categories', authenticate, requirePermission('analytics:read'), getCategorySales);
router.get('/suppliers', authenticate, requirePermission('analytics:read'), getSupplierAnalytics);
router.get('/customers', authenticate, requirePermission('analytics:read'), getCustomerAnalytics);

export default router;
