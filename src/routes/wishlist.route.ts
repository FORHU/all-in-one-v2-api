import express from 'express';
import { getWishlist, addItem, removeItem } from '../controllers/wishlist.controller';

const router = express.Router();

router.get('/', getWishlist);
router.post('/items', addItem);
router.delete('/items/:itemId', removeItem);

export default router;
