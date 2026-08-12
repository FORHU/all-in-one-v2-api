import express from 'express';
import { listReturns, createReturn, getReturnsByOrderId, issueRefund } from './return.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../../middleware/auth.middleware';

const router = express.Router();

// Admin return management listing — every status, paginated, tenant-scoped.
router.get('/', authenticate, authorize(...ADMIN_ROLES), listReturns);
router.post('/', authenticate, authorize(...ADMIN_ROLES), createReturn);
router.get('/order/:orderId', authenticate, authorize(...ADMIN_ROLES), getReturnsByOrderId);
router.post('/:returnId/refund', authenticate, authorize(...ADMIN_ROLES), issueRefund);

export default router;
