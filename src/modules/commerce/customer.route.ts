import express from 'express';
import CustomerController from './customer.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../../middleware/auth.middleware';

const router = express.Router();

// Listing customers is an admin operation, same as GET /api/v2/users.
router.get('/', authenticate, authorize(...ADMIN_ROLES), CustomerController.index);

export default router;
