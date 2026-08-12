import { Router } from 'express';
import { importProduct } from './product-import.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// POST /api/v2/products/import
router.post('/import', authenticate, requirePermission('catalog:write'), importProduct);

export default router;
