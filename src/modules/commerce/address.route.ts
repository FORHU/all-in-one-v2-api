import express from 'express';
import AddressController from './address.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = express.Router();

// Saved addresses are tied to a signed-in customer — no guest support,
// same reasoning as GET /api/v2/orders/my-orders.
router.get('/latest', authenticate, AddressController.getLatest);
router.post('/', authenticate, AddressController.create);

export default router;
