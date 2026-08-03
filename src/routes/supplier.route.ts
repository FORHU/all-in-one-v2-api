import express from 'express';
import {
  createPartner,
  getPartners,
  getSyncJobs,
  updateCredentials,
  getSyncLogs,
  getSupplierCatalog,
} from '../controllers/supplier.controller';

const router = express.Router();

router.post('/partners', createPartner);
router.get('/partners', getPartners);
router.put('/partners/:partnerId/credentials', updateCredentials);
router.get('/partners/:partnerId/catalog', getSupplierCatalog);
router.get('/sync-jobs', getSyncJobs);
router.get('/sync-jobs/:jobId/logs', getSyncLogs);

export default router;
