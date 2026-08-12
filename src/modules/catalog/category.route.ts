import express from 'express';
import CategoryController from './category.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

router.get('/', CategoryController.getRootCategories);
router.get('/:slug', CategoryController.getBySlug);

router.post('/', authenticate, requirePermission('catalog:write'), CategoryController.create);
router.put('/:id', authenticate, requirePermission('catalog:write'), CategoryController.update);
router.delete('/:id', authenticate, requirePermission('catalog:delete'), CategoryController.delete);

export default router;
