import express from 'express';
import { createReturn, getReturnsByOrderId, issueRefund } from './return.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

router.post('/', authenticate, requirePermission('orders:write'), createReturn);
router.get('/order/:orderId', authenticate, requirePermission('orders:read'), getReturnsByOrderId);
router.post('/:returnId/refund', authenticate, requirePermission('orders:refund'), issueRefund);

export default router;
