import express from 'express';
import { ProductSyncController } from '../controllers/product-sync.controller';

const router = express.Router();

router.post('/sync', ProductSyncController.syncProducts);

export default router;
