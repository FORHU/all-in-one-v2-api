import express from 'express';
import PromotionController from './promotion.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Public storefront routes for checking promo code validity
router.get('/code/:code', PromotionController.getByCode);

// Admin campaign management routes
router.get('/', authenticate, requirePermission('catalog:read'), PromotionController.list);
router.get('/:id', authenticate, requirePermission('catalog:read'), PromotionController.getById);
router.post('/', authenticate, requirePermission('catalog:write'), PromotionController.create);
router.put('/:id', authenticate, requirePermission('catalog:write'), PromotionController.update);
router.delete(
  '/:id',
  authenticate,
  requirePermission('catalog:delete'),
  PromotionController.delete,
);
router.get(
  '/pricing/rules',
  authenticate,
  requirePermission('catalog:read'),
  PromotionController.getPricingRules,
);

export default router;
