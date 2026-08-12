import { Prisma, ReturnStatus } from '@prisma/client';
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

  // New models added for 100% coverage
  static async createRefund(tenantId: string, orderId: string, returnId: string, amount: number) {
    return prisma.refund.create({
      data: {
        tenantId,
        orderId,
        returnId,
        amount,
        status: 'PENDING', // Assuming RefundStatus enum
      },
    });
  }
}
