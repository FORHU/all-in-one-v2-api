import express from 'express';
import PromotionController from '../controllers/promotion.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

// Public storefront routes for checking promo code validity
router.get('/code/:code', PromotionController.getByCode);

// Admin campaign management routes
router.get('/', authenticate, authorize(...ADMIN_ROLES), PromotionController.list);
router.get('/:id', authenticate, authorize(...ADMIN_ROLES), PromotionController.getById);
router.post('/', authenticate, authorize(...ADMIN_ROLES), PromotionController.create);
router.put('/:id', authenticate, authorize(...ADMIN_ROLES), PromotionController.update);
router.delete('/:id', authenticate, authorize(...ADMIN_ROLES), PromotionController.delete);

export default router;
