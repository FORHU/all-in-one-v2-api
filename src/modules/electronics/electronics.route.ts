import express, { Request, Response, NextFunction } from 'express';
import ElectronicsSourcingController from './electronics-sourcing.controller';
import ElectronicsCatalogController from './electronics-catalog.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { ELECTRONICS_TENANT_SLUG } from './electronics.config';

const router = express.Router();

/**
 * Electronics-only: the request must resolve to the electronics tenant
 * (digitfriend host or `x-tenant-slug: electronics`). This also makes
 * requirePermission check the caller's electronics membership, not some
 * other store's.
 */
const requireElectronicsTenant = (req: Request, res: Response, next: NextFunction) => {
  if (req.tenantSlug !== ELECTRONICS_TENANT_SLUG) {
    return res
      .status(403)
      .json({ message: 'This endpoint is only available for the electronics storefront' });
  }
  next();
};

router.use(requireElectronicsTenant);

// Public storefront listing — shoppers browse without signing in.
router.get('/products', ElectronicsCatalogController.listProducts);

// CJ sourcing — staff only.
router.get(
  '/cj/categories',
  authenticate,
  requirePermission('catalog:read'),
  ElectronicsSourcingController.categories,
);
router.get(
  '/cj/search',
  authenticate,
  requirePermission('catalog:read'),
  ElectronicsSourcingController.search,
);
router.post(
  '/cj/import',
  authenticate,
  requirePermission('catalog:write'),
  ElectronicsSourcingController.import,
);

export default router;
