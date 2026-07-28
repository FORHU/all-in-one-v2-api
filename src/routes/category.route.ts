import express from 'express';
import CategoryController from '../controllers/category.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/', CategoryController.getRootCategories);
router.get('/:slug', CategoryController.getBySlug);

router.post('/', authenticate, authorize(...ADMIN_ROLES), CategoryController.create);
router.put('/:id', authenticate, authorize(...ADMIN_ROLES), CategoryController.update);
router.delete('/:id', authenticate, authorize(...ADMIN_ROLES), CategoryController.delete);

export default router;
