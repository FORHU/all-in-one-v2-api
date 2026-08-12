import express from 'express';
import TenantController from './tenant.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Public: the storefront needs to list verticals and resolve one by slug.
router.get('/', TenantController.listTenants);

// Platform admin: create or update store verticals
router.get(
  '/all',
  authenticate,
  requirePermission('platform:manage'),
  TenantController.listAllTenants,
);
router.post('/', authenticate, requirePermission('platform:manage'), TenantController.createTenant);
router.patch(
  '/:id',
  authenticate,
  requirePermission('tenant_settings:write'),
  TenantController.updateTenant,
);

// Declared last so it can't shadow /all.
router.get('/:slug', TenantController.getTenant);

export default router;
