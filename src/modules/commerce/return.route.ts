import express from 'express';
import { listReturns, createReturn, getReturnsByOrderId, issueRefund } from './return.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Admin return management listing — every status, paginated, tenant-scoped.
router.get('/', authenticate, requirePermission('orders:read'), listReturns);
router.post('/', authenticate, requirePermission('orders:write'), createReturn);
router.get('/order/:orderId', authenticate, requirePermission('orders:read'), getReturnsByOrderId);
router.post('/:returnId/refund', authenticate, requirePermission('orders:refund'), issueRefund);

export default router;

