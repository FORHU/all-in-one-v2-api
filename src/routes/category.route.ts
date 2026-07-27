import express from 'express';
import CategoryController from '../controllers/category.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/', CategoryController.getRootCategories);
router.get('/:slug', CategoryController.getBySlug);
router.post('/', authenticate, CategoryController.create);
router.put('/:id', authenticate, CategoryController.update);
router.delete('/:id', authenticate, CategoryController.delete);

export default router;
