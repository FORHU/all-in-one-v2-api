import express from 'express';
import CartController from '../controllers/cart.controller';

const router = express.Router();

router.get('/', CartController.getCart);
router.post('/items', CartController.addItem);
router.put('/items/:cartItemId', CartController.updateItemQuantity);
router.delete('/items/:cartItemId', CartController.removeItem);

export default router;
