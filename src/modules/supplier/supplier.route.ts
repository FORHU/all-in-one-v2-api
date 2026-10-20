import express from 'express';
import {
  createPartner,
  getPartners,
  getSyncJobs,
  updateCredentials,
  getSyncLogs,
  getSupplierCatalog,
  searchSupplierProducts,
  getSupplierProductDetails,
  getAvailableSuppliers,
} from './supplier.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// SupplierPartner/SupplierCredential carry no tenantId — they're shared
// platform-wide config (e.g. the CJ/AliExpress API keys every store's
// product-sourcing runs through), so only a platform role may write them,
// same bar as tenant creation. These previously had no auth at all, meaning
// any caller — logged in or not — could overwrite another integration's
// live API credentials.
router.post('/partners', authenticate, requirePermission('platform:manage'), createPartner);
router.put(
  '/partners/:partnerId/credentials',
  authenticate,
  requirePermission('platform:manage'),
  updateCredentials,
);

router.get('/partners', authenticate, getPartners);
router.get('/partners/:partnerId/catalog', authenticate, getSupplierCatalog);
router.get('/sync-jobs', authenticate, getSyncJobs);
router.get('/sync-jobs/:jobId/logs', authenticate, getSyncLogs);

// Direct API routes to search and fetch from the supplier directly
router.get('/available', authenticate, getAvailableSuppliers);
router.get('/:supplierId/search', authenticate, searchSupplierProducts);
router.get('/:supplierId/products/:externalId', authenticate, getSupplierProductDetails);

export default router;
