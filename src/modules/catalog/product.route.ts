import express from 'express';
import ProductController from './product.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Public, tenant-scoped storefront product listing — category-filtered,
// faceted, sortable, paginated. Distinct from product-sync (admin, enqueues
// supplier syncs) and product-import (admin, bulk import) which mount at the
// same /v2/products prefix.
router.get('/', ProductController.list);

// Admin product management listing — every status (including drafts), auth
// required. Must be registered before any `/:id`-shaped route is added here.
router.get('/admin', authenticate, requirePermission('catalog:read'), ProductController.adminList);

// Admin Brands page — distinct brand values + product counts. Also static,
// also must come before `/:slug`.
router.get('/brands', authenticate, requirePermission('catalog:read'), ProductController.getBrands);

// Bulk rename/clear a brand across every product carrying it — the
// closest thing to edit/delete for a value with no row of its own. Also
// static, also must come before `/:slug`.
router.patch(
  '/brands/:brand',
  authenticate,
  requirePermission('catalog:write'),
  ProductController.renameBrand,
);

// Admin variant management — nested under a product. `/:productId/variants`
// has more path segments than `/:slug`/`/:id` so it can't collide with them,
// but registered together with the rest of the admin product routes for
// readability.
router.get(
  '/:productId/variants',
  authenticate,
  requirePermission('catalog:read'),
  ProductController.listVariants,
);
router.post(
  '/:productId/variants',
  authenticate,
  requirePermission('catalog:write'),
  ProductController.createVariant,
);
router.put(
  '/:productId/variants/:variantId',
  authenticate,
  requirePermission('catalog:write'),
  ProductController.updateVariant,
);
router.delete(
  '/:productId/variants/:variantId',
  authenticate,
  requirePermission('catalog:delete'),
  ProductController.deleteVariant,
);

router.get('/:slug', ProductController.getBySlug);

router.post('/', authenticate, requirePermission('catalog:write'), ProductController.create);
router.put('/:id', authenticate, requirePermission('catalog:write'), ProductController.update);
router.delete('/:id', authenticate, requirePermission('catalog:delete'), ProductController.delete);

export default router;
