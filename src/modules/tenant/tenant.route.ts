import express from 'express';
import { UserRole } from '@prisma/client';
import TenantController from './tenant.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../../middleware/auth.middleware';

const router = express.Router();

// Public: the storefront needs to list verticals and resolve one by slug.
router.get('/', TenantController.listTenants);

// Admin & Seller: create or update store verticals
router.get(
  '/all',
  authenticate,
  authorize(...ADMIN_ROLES, UserRole.SELLER),
  TenantController.listAllTenants,
);
router.post(
  '/',
  authenticate,
  authorize(...ADMIN_ROLES, UserRole.SELLER),
  TenantController.createTenant,
);
router.patch(
  '/:id',
  authenticate,
  authorize(...ADMIN_ROLES, UserRole.SELLER),
  TenantController.updateTenant,
);

// Declared last so it can't shadow /all.
router.get('/:slug', TenantController.getTenant);

export default router;
