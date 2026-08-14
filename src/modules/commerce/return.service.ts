import ReturnRepository from './return.repository';
import PaymentService from './payment.service';
import { requireTenantId } from '../../utils/async-context';
import { Prisma, ReturnStatus } from '@prisma/client';

export default class ReturnService {
  static async createReturn(data: Omit<Prisma.ReturnCreateInput, 'tenant'>) {
    return ReturnRepository.createReturn(requireTenantId(), data);
  }

  static async getReturnsByOrderId(orderId: string) {
    return ReturnRepository.findByOrderId(requireTenantId(), orderId);
  }

  /** Paginated admin return list, scoped to the current tenant. */
  static async listReturns(
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: ReturnStatus,
  ) {
    return ReturnRepository.findAll(
      requireTenantId(),
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      status,
    );
  }

  /**
   * Issues a real Stripe refund (PaymentService.refundPayment) and records
   * it as a Refund row. The Refund/Payment don't get marked COMPLETED/
   * REFUNDED here — that only happens once Stripe's `charge.refunded`
   * webhook confirms the money actually moved (see
   * PaymentService.handleWebhook and ReturnRepository.markMostRecentPendingRefundCompleted).
   */
  static async issueRefund(orderId: string, returnId: string, amount: number) {
    const tenantId = requireTenantId();
    const { transactionId } = await PaymentService.refundPayment(orderId, amount);
    const refund = await ReturnRepository.createRefund(
      tenantId,
      orderId,
      returnId,
      amount,
      transactionId,
    );
    await ReturnRepository.updateReturnStatus(tenantId, returnId, ReturnStatus.COMPLETED);
    return refund;
  }
}
