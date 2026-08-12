import express from 'express';
import AttributeController from './attribute.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Storefront public attribute routes (for product filter menus)
router.get('/', AttributeController.list);
router.get('/:id', AttributeController.getById);

// Admin attribute CRUD routes
router.post('/', authenticate, requirePermission('catalog:write'), AttributeController.create);
router.put('/:id', authenticate, requirePermission('catalog:write'), AttributeController.update);
router.delete(
  '/:id',
  authenticate,
  requirePermission('catalog:delete'),
  AttributeController.delete,
);

// Admin attribute value routes
router.post(
  '/:id/values',
  authenticate,
  requirePermission('catalog:write'),
  AttributeController.addValue,
);
router.delete(
  '/values/:valueId',
  authenticate,
  requirePermission('catalog:delete'),
  AttributeController.deleteValue,
);

// Admin variant attribute mapping
router.post(
  '/variant-attributes',
  authenticate,
  requirePermission('catalog:write'),
  AttributeController.setVariantAttributes,
);

export default router;
