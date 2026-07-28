import { Router } from 'express';
import { importProduct } from '../controllers/product-import.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = Router();

// POST /api/v2/products/import
router.post('/import', authenticate, authorize(...ADMIN_ROLES), importProduct);

export default router;
