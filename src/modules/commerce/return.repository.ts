import { Prisma, ReturnStatus, RefundStatus } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { paginate } from '../../helpers/pagination.helper';

export default class ReturnRepository {
  // Fields the admin returns list can sort by — same whitelist reasoning as
  // OrderRepository.SORTABLE_FIELDS.
  private static readonly SORTABLE_FIELDS = new Set(['createdAt', 'updatedAt', 'status']);

  static async createReturn(tenantId: string, data: Omit<Prisma.ReturnCreateInput, 'tenant'>) {
    return prisma.return.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  static async findByOrderId(tenantId: string, orderId: string) {
    return prisma.return.findMany({
      where: { tenantId, orderId },
      include: { refund: true },
    });
  }

  /**
   * Just enough of the order to drive the returns UI (prefill a refund
   * amount, know whether there's a customer to attach a new return to) —
   * lets the returns feature answer "does this order have any open
   * returns, and what's it worth" from its own endpoint, without the
   * frontend needing to cross into the orders feature for it.
   */
  static async getOrderSummary(tenantId: string, orderId: string) {
    return prisma.commerceOrder.findFirst({
      where: { id: orderId, tenantId },
      select: { id: true, customerId: true, totalAmount: true, currency: true },
    });
  }

  static async findById(tenantId: string, returnId: string) {
    return prisma.return.findFirst({
      where: { id: returnId, tenantId },
      include: { refund: true },
    });
  }

  /**
   * Paginated list for the admin returns page, scoped to one tenant.
   * Search matches the return reason, the order's number, or the requesting
   * customer's name/email.
   */
  static async findAll(
    tenantId: string,
    page = 1,
    limit = 20,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    status?: ReturnStatus,
  ) {
    const where: Prisma.ReturnWhereInput = {
      tenantId,
      ...(status && { status }),
      ...(search && {
        OR: [
          { reason: { contains: search, mode: 'insensitive' } },
          { order: { is: { orderNumber: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { email: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { firstName: { contains: search, mode: 'insensitive' } } } },
          { customer: { is: { lastName: { contains: search, mode: 'insensitive' } } } },
        ],
      }),
    };

    const orderBy: Prisma.ReturnOrderByWithRelationInput =
      sortBy && this.SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { createdAt: 'desc' };

    return paginate(prisma.return, {
      where,
      orderBy,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      filters: status ? { status } : undefined,
      include: {
        order: { select: { id: true, orderNumber: true, totalAmount: true, currency: true } },
        customer: { select: { email: true, firstName: true, lastName: true } },
        refund: { select: { id: true, amount: true, status: true } },
      },
    });
  }

  static async createRefund(
    tenantId: string,
    orderId: string,
    returnId: string,
    amount: number,
    transactionId?: string,
    reason?: string,
  ) {
    return prisma.refund.create({
      data: {
        tenantId,
        orderId,
        returnId,
        amount,
        status: RefundStatus.PENDING,
        ...(transactionId ? { transactionId } : {}),
        ...(reason ? { reason } : {}),
      },
    });
  }

  static async updateReturnStatus(
    tenantId: string,
    returnId: string,
    status: ReturnStatus,
    notes?: string,
  ) {
    return prisma.return.updateMany({
      where: { id: returnId, tenantId },
      data: { status, ...(notes !== undefined ? { notes } : {}) },
    });
  }

  /**
   * Marks the most recently created still-PENDING Refund for an order as
   * COMPLETED, once Stripe's `charge.refunded` webhook confirms the money
   * actually moved (see PaymentService.handleWebhook). Matches by order
   * rather than the specific Stripe refund id on the assumption that an
   * order has at most one refund in flight at a time — reasonable for this
   * store's scale, but would need tightening if concurrent partial refunds
   * on the same order become a real scenario.
   */
  static async markMostRecentPendingRefundCompleted(orderId: string) {
    const pending = await prisma.refund.findFirst({
      where: { orderId, status: RefundStatus.PENDING },
      orderBy: { createdAt: 'desc' },
    });
    if (!pending) return null;

    return prisma.refund.update({
      where: { id: pending.id },
      data: { status: RefundStatus.COMPLETED },
    });
  }
}
