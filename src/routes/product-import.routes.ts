import { Router } from 'express';
import { importProduct } from '../controllers/product-import.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// POST /api/v2/products/import
// Ideally, add an admin check middleware here as well.
router.post('/import', authenticate, importProduct);

export default router;
