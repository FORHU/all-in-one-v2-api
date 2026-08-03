import CouponRepository from '../repositories/coupon.repository';
import { Prisma } from '@prisma/client';
import { requireTenantId } from '../utils/async-context';

export default class CouponService {
  static async createCoupon(data: Omit<Prisma.CouponCreateInput, 'tenant'>) {
    return CouponRepository.createCoupon(requireTenantId(), data);
  }

  static async validateCoupon(code: string) {
    return CouponRepository.findByCode(requireTenantId(), code);
  }

  static async listCoupons() {
    return CouponRepository.listCoupons(requireTenantId());
  }
}
