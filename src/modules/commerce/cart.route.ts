import express from 'express';
import CartController from './cart.controller';
import { optionalAuthenticate } from '../../middleware/auth.middleware';

const router = express.Router();

// Carts belong either to a signed-in customer or to an x-session-id guest, so
// every route resolves the caller and then checks ownership in the service.
router.use(optionalAuthenticate);

router.get('/', CartController.getCart);
router.post('/items', CartController.addItem);
router.put('/items/:cartItemId', CartController.updateItemQuantity);
router.delete('/items/:cartItemId', CartController.removeItem);

export default router;
