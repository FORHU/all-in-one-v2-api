import express from 'express';
import TenantController from '../controllers/tenant.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

// Public: the storefront needs to list verticals and resolve one by slug.
router.get('/', TenantController.listTenants);

// Admin: verticals are created by the platform, never self-service.
router.get('/all', authenticate, authorize(...ADMIN_ROLES), TenantController.listAllTenants);
router.post('/', authenticate, authorize(...ADMIN_ROLES), TenantController.createTenant);
router.patch('/:id', authenticate, authorize(...ADMIN_ROLES), TenantController.updateTenant);

// Declared last so it can't shadow /all.
router.get('/:slug', TenantController.getTenant);

export default router;
