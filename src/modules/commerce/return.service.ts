import ReturnRepository from './return.repository';
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

  static async issueRefund(orderId: string, returnId: string, amount: number) {
    return ReturnRepository.createRefund(requireTenantId(), orderId, returnId, amount);
  }
}
