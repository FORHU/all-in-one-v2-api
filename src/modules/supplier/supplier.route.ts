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

const router = express.Router();

router.post('/partners', createPartner);
router.get('/partners', getPartners);
router.put('/partners/:partnerId/credentials', updateCredentials);
router.get('/partners/:partnerId/catalog', getSupplierCatalog);
router.get('/sync-jobs', getSyncJobs);
router.get('/sync-jobs/:jobId/logs', getSyncLogs);

// Direct API routes to search and fetch from the supplier directly
router.get('/available', getAvailableSuppliers);
router.get('/:supplierId/search', searchSupplierProducts);
router.get('/:supplierId/products/:externalId', getSupplierProductDetails);

export default router;
