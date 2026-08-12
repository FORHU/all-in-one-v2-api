import express from 'express';
import ProductController from './product.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../../middleware/auth.middleware';

const router = express.Router();

// Public, tenant-scoped storefront product listing — category-filtered,
// faceted, sortable, paginated. Distinct from product-sync (admin, enqueues
// supplier syncs) and product-import (admin, bulk import) which mount at the
// same /v2/products prefix.
router.get('/', ProductController.list);

// Admin product management listing — every status (including drafts), auth
// required. Must be registered before any `/:id`-shaped route is added here.
router.get('/admin', authenticate, authorize(...ADMIN_ROLES), ProductController.adminList);

export default router;
