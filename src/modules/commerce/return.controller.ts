import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { ReturnStatus } from '@prisma/client';
import ReturnService from './return.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';
import { resolveCustomerId } from '../../helpers/requester.helper';
import { requireTenantId, requireTenantSlug } from '../../utils/async-context';
import { uploadToS3 } from '../../utils/s3.util';
import { throwResponse } from '../../utils/throw-response';

const createReturnRequestSchema = Joi.object({
  orderId: Joi.string().required(),
  items: Joi.array()
    .items(
      Joi.object({
        orderItemId: Joi.string().required(),
        quantity: Joi.number().integer().min(1).required(),
      }),
    )
    .min(1)
    .required(),
  requestType: Joi.string().valid('REFUND', 'REPLACEMENT', 'RETURN').required(),
  reason: Joi.string().trim().max(200).required(),
  description: Joi.string().trim().max(2000).optional(),
  preferredResolution: Joi.string().valid('REFUND', 'REPLACEMENT').optional(),
  evidence: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        mimeType: Joi.string().optional(),
      }),
    )
    .optional(),
});

/**
 * GET /api/v2/returns
 */
export const listReturns = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page, limit, search, sortBy, sortOrder } = parsePagination(
      req.query as Record<string, unknown>,
    );
    const rawStatus = req.query.status as string | undefined;
    const customerResponded = rawStatus === 'CUSTOMER_RESPONDED';
    const status =
      !customerResponded &&
      rawStatus &&
      (Object.values(ReturnStatus) as string[]).includes(rawStatus)
        ? (rawStatus as ReturnStatus)
        : undefined;

    const result = await ReturnService.listReturns(
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status,
      customerResponded,
    );
    return responseSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v2/returns/my — customer-facing request creation, step 1 of the
 * new refund/replacement/return flow. Ownership + eligibility are enforced
 * inside ReturnService.createReturnRequest, not here.
 */
export const createReturnRequest = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = createReturnRequestSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);

  try {
    const customerId = await resolveCustomerId(req);
    if (!customerId) return responseError(res, 401, 'Unauthorized');

    const created = await ReturnService.createReturnRequest({
      orderId: value.orderId,
      customerId,
      items: value.items,
      requestType: value.requestType,
      reason: value.reason,
      description: value.description,
      preferredResolution: value.preferredResolution,
      evidence: value.evidence,
    });
    return responseSuccess(res, 201, created, 'Request submitted');
  } catch (err) {
    next(err);
  }
};

/** GET /api/v2/returns/my — the signed-in customer's own requests, lightweight (status + type only). */
export const getMyReturnRequests = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = await resolveCustomerId(req);
    if (!customerId) return responseError(res, 401, 'Unauthorized');

    const requests = await ReturnService.getMyReturnRequests(customerId);
    return responseSuccess(res, 200, requests);
  } catch (error) {
    next(error);
  }
};

/** GET /api/v2/returns/my/:id — full, customer-safe detail for one request. Backs "View Request Status". */
export const getMyReturnRequestDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const customerId = await resolveCustomerId(req);
    if (!customerId) return responseError(res, 401, 'Unauthorized');

    const detail = await ReturnService.getMyReturnRequestDetail(req.params.id, customerId);
    return responseSuccess(res, 200, detail);
  } catch (error) {
    next(error);
  }
};

const addCustomerEvidenceSchema = Joi.object({
  evidence: Joi.array()
    .items(
      Joi.object({
        url: Joi.string().uri().required(),
        mimeType: Joi.string().optional(),
      }),
    )
    .min(1)
    .required(),
});

/**
 * POST /api/v2/returns/my/:id/evidence — customer resubmits evidence after
 * an admin's "request more evidence". Ownership is enforced inside
 * ReturnService.addCustomerEvidence, same idiom as createReturnRequest.
 */
export const addCustomerEvidence = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = addCustomerEvidenceSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);

  try {
    const customerId = await resolveCustomerId(req);
    if (!customerId) return responseError(res, 401, 'Unauthorized');

    const updated = await ReturnService.addCustomerEvidence(
      req.params.id,
      customerId,
      value.evidence,
    );
    return responseSuccess(res, 200, updated, 'Evidence submitted');
  } catch (err) {
    next(err);
  }
};

/**
 * POST /api/v2/returns/evidence-upload — a signed-in customer uploading a
 * photo/video for their own request. Reuses upload.middleware.ts's multer
 * config and s3.util.ts's uploadToS3 verbatim, same as the existing
 * staff-only fileUpload.route.ts, just under a customer-reachable route
 * (that one is gated by `catalog:write`, wrong axis for a customer's own
 * upload). No AuthFile row is created here, same as the staff route —
 * the returned URL is stored directly on ReturnEvidence.
 */
export const uploadReturnEvidence = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return throwResponse(400, 'No file uploaded');

    const tenantId = requireTenantId();
    const tenantSlug = requireTenantSlug();
    const customerId = await resolveCustomerId(req);
    if (!customerId) return throwResponse(401, 'Unauthorized');

    const url = await uploadToS3({
      buffer: req.file.buffer,
      mimetype: req.file.mimetype,
      originalName: req.file.originalname,
      folder: `returns-evidence/${tenantSlug}/${tenantId}/${customerId}`,
    });

    return responseSuccess(
      res,
      201,
      { url, mimetype: req.file.mimetype, size: req.file.size },
      'Evidence uploaded',
    );
  } catch (error) {
    next(error);
  }
};

const requestEvidenceSchema = Joi.object({
  note: Joi.string().trim().min(1).max(1000).required(),
});

const approveRequestSchema = Joi.object({
  note: Joi.string().trim().max(1000).optional(),
});

const rejectRequestSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(1000).required(),
});

/**
 * GET /api/v2/returns/:id/detail — full admin review screen: order/customer
 * context, items, evidence, disputes, financials, status history.
 */
export const getReturnDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const detail = await ReturnService.getReturnDetail(req.params.id);
    return responseSuccess(res, 200, detail);
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/v2/returns/:id/status/under-review */
export const startReturnReview = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await ReturnService.transitionToUnderReview(req.params.id, req.user?.id);
    return responseSuccess(res, 200, updated, 'Request moved to review');
  } catch (error) {
    next(error);
  }
};

/** PATCH /api/v2/returns/:id/status/evidence-required */
export const requestReturnEvidence = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = requestEvidenceSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);

  try {
    const updated = await ReturnService.requestMoreEvidence(
      req.params.id,
      value.note,
      req.user?.id,
    );
    return responseSuccess(res, 200, updated, 'Evidence requested');
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v2/returns/:id/status/approve */
export const approveReturnRequest = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = approveRequestSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);

  try {
    const updated = await ReturnService.approveReturnRequest(
      req.params.id,
      value.note,
      req.user?.id,
    );
    return responseSuccess(res, 200, updated, 'Request approved');
  } catch (err) {
    next(err);
  }
};

/** PATCH /api/v2/returns/:id/status/reject */
export const rejectReturnRequest = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = rejectRequestSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);

  try {
    const updated = await ReturnService.rejectReturnRequest(
      req.params.id,
      value.reason,
      req.user?.id,
    );
    return responseSuccess(res, 200, updated, 'Request rejected');
  } catch (err) {
    next(err);
  }
};

const confirmDisputeOutcomeSchema = Joi.object({
  outcome: Joi.string().valid('APPROVED', 'REJECTED').required(),
  note: Joi.string().trim().max(1000).optional(),
});

/**
 * POST /api/v2/returns/:id/dispute/file — admin tries to recover AddictStyle's
 * cost from CJ before ever refunding the customer out of pocket.
 */
export const fileCjDispute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ReturnService.fileCjDispute(req.params.id, req.user?.id);
    return responseSuccess(
      res,
      result.filed ? 201 : 200,
      result,
      result.filed ? 'Dispute filed with supplier' : 'Could not file dispute with supplier',
    );
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/v2/returns/:id/dispute/refresh — on-demand pull of CJ's current
 * ruling, same pull-not-polled pattern as GET /orders/:id/tracking. Never
 * changes Return.status itself — see ReturnService.refreshCjDispute.
 */
export const refreshCjDispute = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ReturnService.refreshCjDispute(req.params.id);
    return responseSuccess(res, 200, result);
  } catch (error) {
    next(error);
  }
};

/** POST /api/v2/returns/:id/dispute/confirm-outcome — the explicit admin decision CJ's unverified live API requires. */
export const confirmCjDisputeOutcome = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = confirmDisputeOutcomeSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);

  try {
    const updated = await ReturnService.confirmCjOutcome(
      req.params.id,
      value.outcome,
      value.note,
      req.user?.id,
    );
    return responseSuccess(res, 200, updated, 'Outcome recorded');
  } catch (err) {
    next(err);
  }
};

const processRefundSchema = Joi.object({
  amount: Joi.number().positive().required(),
  note: Joi.string().trim().max(1000).optional(),
  costCoveredBy: Joi.string()
    .valid('CJ', 'ADDICTSTYLE', 'CUSTOMER_NOT_REFUNDED', 'SPLIT')
    .optional(),
});

/**
 * POST /api/v2/returns/:id/process-refund — the actual refund, callable
 * from APPROVED/CJ_APPROVED/CJ_REJECTED/RETURN_PROCESSING. Distinct from
 * the legacy POST /:returnId/refund (issueRefund), which only ever worked
 * from plain APPROVED and has no cost-attribution bookkeeping.
 */
export const processRefund = async (req: Request, res: Response, next: NextFunction) => {
  const { error, value } = processRefundSchema.validate(req.body);
  if (error) return responseError(res, 400, error.message);

  try {
    const updated = await ReturnService.processRefund(
      req.params.id,
      value.amount,
      value.note,
      value.costCoveredBy,
      req.user?.id,
    );
    return responseSuccess(res, 200, updated, 'Refund is processing');
  } catch (err) {
    next(err);
  }
};

export const createReturn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId, customerId, reason, notes } = req.body;
    const returnReq = await ReturnService.createReturn({ orderId, customerId, reason, notes });
    return responseSuccess(res, 201, returnReq);
  } catch (error) {
    next(error);
  }
};

export const getReturnsByOrderId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { orderId } = req.params;
    const returns = await ReturnService.getReturnsByOrderId(orderId);
    return responseSuccess(res, 200, returns);
  } catch (error) {
    next(error);
  }
};

export const approveReturn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await ReturnService.approveReturn(req.params.id);
    return responseSuccess(res, 200, result, 'Return approved');
  } catch (error) {
    next(error);
  }
};

export const rejectReturn = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { notes } = req.body;
    const result = await ReturnService.rejectReturn(req.params.id, notes);
    return responseSuccess(res, 200, result, 'Return rejected');
  } catch (error) {
    next(error);
  }
};

export const issueRefund = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { returnId } = req.params;
    const { orderId, amount, reason } = req.body;
    const refund = await ReturnService.issueRefund(orderId, returnId, amount, reason);
    return responseSuccess(res, 201, refund);
  } catch (error) {
    next(error);
  }
};
