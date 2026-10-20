import express from 'express';
import {
  listReturns,
  createReturn,
  createReturnRequest,
  uploadReturnEvidence,
  getMyReturnRequests,
  getMyReturnRequestDetail,
  addCustomerEvidence,
  getReturnDetail,
  startReturnReview,
  requestReturnEvidence,
  approveReturnRequest,
  rejectReturnRequest,
  fileCjDispute,
  refreshCjDispute,
  confirmCjDisputeOutcome,
  processRefund,
  getReturnsByOrderId,
  approveReturn,
  rejectReturn,
  issueRefund,
} from './return.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { upload } from '../../middleware/upload.middleware';
import { restoreTenantContext } from '../../middleware/tenant.middleware';

const router = express.Router();

// Admin return management listing — every status, paginated, tenant-scoped.
router.get('/', authenticate, requirePermission('orders:read'), listReturns);
router.post('/', authenticate, requirePermission('orders:write'), createReturn);

// Customer-facing — a signed-in customer creating/evidencing their own
// refund/replacement/return request. No requirePermission: ownership is
// enforced inside ReturnService.createReturnRequest itself, same
// "backend-enforced ownership, not a coarse permission" idiom GET /orders/:id
// already uses.
router.post(
  '/evidence-upload',
  authenticate,
  upload.single('file'),
  // multer's multipart parsing sits between resolveTenant and this handler
  // and can drop AsyncLocalStorage continuity — re-enter it before
  // requireTenantId() runs inside uploadReturnEvidence. Same fix
  // fileUpload.route.ts already applies to its own upload route.
  restoreTenantContext,
  uploadReturnEvidence,
);
router.post('/my', authenticate, createReturnRequest);
router.get('/my', authenticate, getMyReturnRequests);
router.get('/my/:id', authenticate, getMyReturnRequestDetail);
router.post('/my/:id/evidence', authenticate, addCustomerEvidence);

router.get('/order/:orderId', authenticate, requirePermission('orders:read'), getReturnsByOrderId);
router.patch('/:id/approve', authenticate, requirePermission('orders:write'), approveReturn);
router.patch('/:id/reject', authenticate, requirePermission('orders:write'), rejectReturn);
router.post('/:returnId/refund', authenticate, requirePermission('orders:refund'), issueRefund);

// Admin review of the new, richer request lifecycle (step 2 of the
// refund/replacement/return flow) — reuses orders:read/orders:write, same
// coarse-per-domain RBAC convention every other return/refund endpoint here
// already follows (no returns:* permission namespace exists).
router.get('/:id/detail', authenticate, requirePermission('orders:read'), getReturnDetail);
router.patch(
  '/:id/status/under-review',
  authenticate,
  requirePermission('orders:write'),
  startReturnReview,
);
router.patch(
  '/:id/status/evidence-required',
  authenticate,
  requirePermission('orders:write'),
  requestReturnEvidence,
);
router.patch(
  '/:id/status/approve',
  authenticate,
  requirePermission('orders:write'),
  approveReturnRequest,
);
router.patch(
  '/:id/status/reject',
  authenticate,
  requirePermission('orders:write'),
  rejectReturnRequest,
);

// CJ dispute round trip — filing one and confirming its outcome are real,
// financially-consequential third-party actions, so they're gated behind
// `orders:refund` (same permission issueRefund uses), not the coarser
// `orders:write` the status-transition routes above use. Reading CJ's
// current raw status back is a safe pull, gated `orders:read` like the
// equivalent GET /orders/:id/tracking.
router.post('/:id/dispute/file', authenticate, requirePermission('orders:refund'), fileCjDispute);
router.get(
  '/:id/dispute/refresh',
  authenticate,
  requirePermission('orders:read'),
  refreshCjDispute,
);
router.post(
  '/:id/dispute/confirm-outcome',
  authenticate,
  requirePermission('orders:refund'),
  confirmCjDisputeOutcome,
);

// The actual refund — real money moves, same permission as the legacy
// POST /:returnId/refund. Callable from a wider set of statuses than that
// older route (APPROVED/CJ_APPROVED/CJ_REJECTED/RETURN_PROCESSING vs just
// APPROVED) and records cost-attribution bookkeeping it never did.
router.post('/:id/process-refund', authenticate, requirePermission('orders:refund'), processRefund);

export default router;
