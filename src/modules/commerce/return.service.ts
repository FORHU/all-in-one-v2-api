import ReturnRepository from './return.repository';
import { requireTenantId } from '../../utils/async-context';
import { Prisma } from '@prisma/client';

export default class ReturnService {
  static async createReturn(data: Omit<Prisma.ReturnCreateInput, 'tenant'>) {
    return ReturnRepository.createReturn(requireTenantId(), data);
  }

  static async getReturnsByOrderId(orderId: string) {
    return ReturnRepository.findByOrderId(requireTenantId(), orderId);
  }

  static async issueRefund(orderId: string, returnId: string, amount: number) {
    return ReturnRepository.createRefund(requireTenantId(), orderId, returnId, amount);
  }
}
