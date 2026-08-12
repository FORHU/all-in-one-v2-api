import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export default class ReturnRepository {
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
