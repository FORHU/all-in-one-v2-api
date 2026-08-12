import express from 'express';
import AttributeController from './attribute.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../../middleware/auth.middleware';

const router = express.Router();

// Storefront public attribute routes (for product filter menus)
router.get('/', AttributeController.list);
router.get('/:id', AttributeController.getById);

// Admin attribute CRUD routes
router.post('/', authenticate, authorize(...ADMIN_ROLES), AttributeController.create);
router.put('/:id', authenticate, authorize(...ADMIN_ROLES), AttributeController.update);
router.delete('/:id', authenticate, authorize(...ADMIN_ROLES), AttributeController.delete);

// Admin attribute value routes
router.post('/:id/values', authenticate, authorize(...ADMIN_ROLES), AttributeController.addValue);
router.delete(
  '/values/:valueId',
  authenticate,
  authorize(...ADMIN_ROLES),
  AttributeController.deleteValue,
);

// Admin variant attribute mapping
router.post(
  '/variant-attributes',
  authenticate,
  authorize(...ADMIN_ROLES),
  AttributeController.setVariantAttributes,
);

export default router;
