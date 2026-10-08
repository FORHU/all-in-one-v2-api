import { ReturnStatus } from '@prisma/client';
import { throwResponse } from '../../utils/throw-response';

/**
 * Every legal next state for a refund/replacement/return request, keyed by
 * its current status. Enforced server-side in ReturnService before any
 * status-changing method — the admin frontend mirrors this for UX (hiding
 * buttons that would 409) but the server never trusts that mirror.
 *
 * Shape mirrors this request's real lifecycle:
 *   PENDING -> UNDER_REVIEW -> (EVIDENCE_REQUIRED <-> UNDER_REVIEW) -> APPROVED/REJECTED
 *     -> [optional CJ dispute round trip] -> *_PROCESSING -> COMPLETED
 * CANCELLED is reachable from every non-terminal state (self-cancel or admin
 * cancel); REJECTED/COMPLETED/CANCELLED are terminal.
 */
export const ALLOWED_RETURN_TRANSITIONS: Record<ReturnStatus, ReturnStatus[]> = {
  [ReturnStatus.PENDING]: [ReturnStatus.UNDER_REVIEW, ReturnStatus.CANCELLED],
  [ReturnStatus.UNDER_REVIEW]: [
    ReturnStatus.EVIDENCE_REQUIRED,
    ReturnStatus.APPROVED,
    ReturnStatus.REJECTED,
    ReturnStatus.CANCELLED,
  ],
  [ReturnStatus.EVIDENCE_REQUIRED]: [
    ReturnStatus.UNDER_REVIEW,
    ReturnStatus.REJECTED,
    ReturnStatus.CANCELLED,
  ],
  [ReturnStatus.APPROVED]: [
    ReturnStatus.CJ_DISPUTE_SUBMITTED,
    ReturnStatus.REFUND_PROCESSING,
    ReturnStatus.REPLACEMENT_PROCESSING,
    ReturnStatus.RETURN_PROCESSING,
    ReturnStatus.CANCELLED,
  ],
  [ReturnStatus.REJECTED]: [],
  [ReturnStatus.CJ_DISPUTE_SUBMITTED]: [
    ReturnStatus.CJ_DISPUTE_UNDER_REVIEW,
    ReturnStatus.CJ_APPROVED,
    ReturnStatus.CJ_REJECTED,
    ReturnStatus.CANCELLED,
  ],
  [ReturnStatus.CJ_DISPUTE_UNDER_REVIEW]: [
    ReturnStatus.CJ_APPROVED,
    ReturnStatus.CJ_REJECTED,
    ReturnStatus.CANCELLED,
  ],
  [ReturnStatus.CJ_APPROVED]: [
    ReturnStatus.REFUND_PROCESSING,
    ReturnStatus.REPLACEMENT_PROCESSING,
    ReturnStatus.RETURN_PROCESSING,
  ],
  [ReturnStatus.CJ_REJECTED]: [
    ReturnStatus.REFUND_PROCESSING,
    ReturnStatus.REPLACEMENT_PROCESSING,
    ReturnStatus.REJECTED,
    ReturnStatus.CANCELLED,
  ],
  [ReturnStatus.REFUND_PROCESSING]: [ReturnStatus.COMPLETED, ReturnStatus.CANCELLED],
  [ReturnStatus.REPLACEMENT_PROCESSING]: [ReturnStatus.COMPLETED, ReturnStatus.CANCELLED],
  [ReturnStatus.RETURN_PROCESSING]: [
    ReturnStatus.REFUND_PROCESSING,
    ReturnStatus.REPLACEMENT_PROCESSING,
    ReturnStatus.COMPLETED,
    ReturnStatus.CANCELLED,
  ],
  [ReturnStatus.COMPLETED]: [],
  [ReturnStatus.CANCELLED]: [],
};

/** Throws a 409 (same idiom as the rest of this module) when `to` isn't a legal move from `from`. */
export function assertValidReturnTransition(from: ReturnStatus, to: ReturnStatus): void {
  if (!ALLOWED_RETURN_TRANSITIONS[from]?.includes(to)) {
    throwResponse(409, `Cannot move a request from ${from} to ${to}`);
  }
}
