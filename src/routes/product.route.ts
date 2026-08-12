import express from 'express';
import ProductController from '../controllers/product.controller';

const router = express.Router();

// Public, tenant-scoped storefront product listing — category-filtered,
// faceted, sortable, paginated. Distinct from product-sync (admin, enqueues
// supplier syncs) and product-import (admin, bulk import) which mount at the
// same /v2/products prefix.
router.get('/', ProductController.list);
router.get('/:slug', ProductController.getBySlug);

export default router;
