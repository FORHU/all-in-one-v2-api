import express from 'express';
import PricingRuleController from './pricing-rule.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

router.get('/', authenticate, requirePermission('catalog:read'), PricingRuleController.list);
router.post('/', authenticate, requirePermission('catalog:write'), PricingRuleController.create);
router.put('/:id', authenticate, requirePermission('catalog:write'), PricingRuleController.update);
router.delete('/:id', authenticate, requirePermission('catalog:delete'), PricingRuleController.delete);
router.post(
  '/:id/apply-to-all',
  authenticate,
  requirePermission('catalog:write'),
  PricingRuleController.applyToAll,
);

export default router;
