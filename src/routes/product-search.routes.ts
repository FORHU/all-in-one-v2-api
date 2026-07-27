import { Router } from 'express';
import { searchProducts } from '../controllers/product-search.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// GET /api/v2/product-search?q=keyword
router.get('/', authenticate, searchProducts);

export default router;
