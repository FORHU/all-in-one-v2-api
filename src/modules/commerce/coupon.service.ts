import CouponRepository from './coupon.repository';
import { Coupon, Prisma } from '@prisma/client';
import { requireTenantId } from '../../utils/async-context';
import { throwResponse } from '../../utils/throw-response';

export interface CouponWriteBody {
  code?: string;
  discountType?: 'PERCENTAGE' | 'FIXED_AMOUNT';
  discountValue?: number;
  minOrderValue?: number | null;
  maxDiscount?: number | null;
  usageLimit?: number | null;
  expiresAt?: string | null;
  isActive?: boolean;
}

function coerceDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return throwResponse(400, 'expiresAt is not a valid date');
  return d;
}

export default class CouponService {
  static async createCoupon(body: CouponWriteBody) {
    const tenantId = requireTenantId();
    if (!body.code || !body.code.trim()) return throwResponse(400, 'code is required');
    if (body.discountValue == null) return throwResponse(400, 'discountValue is required');

    const code = body.code.trim();
    const clash = await CouponRepository.findByCode(tenantId, code);
    if (clash) return throwResponse(400, `Coupon code "${code}" already exists`);

    return CouponRepository.createCoupon(tenantId, {
      code,
      discountType: body.discountType ?? 'PERCENTAGE',
      discountValue: new Prisma.Decimal(body.discountValue),
      minOrderValue: body.minOrderValue != null ? new Prisma.Decimal(body.minOrderValue) : null,
      maxDiscount: body.maxDiscount != null ? new Prisma.Decimal(body.maxDiscount) : null,
      usageLimit: body.usageLimit ?? null,
      expiresAt: coerceDate(body.expiresAt) ?? null,
      isActive: body.isActive ?? true,
    });
  }

  static async updateCoupon(id: string, body: CouponWriteBody) {
    const tenantId = requireTenantId();
    const existing = await CouponRepository.findById(tenantId, id);
    if (!existing) return throwResponse(404, 'Coupon not found');

    if (body.code && body.code.trim() !== existing.code) {
      const clash = await CouponRepository.findByCode(tenantId, body.code.trim());
      if (clash && clash.id !== id) {
        return throwResponse(400, `Coupon code "${body.code.trim()}" already exists`);
      }
    }

    const expiresAt = coerceDate(body.expiresAt);

    return CouponRepository.updateCoupon(id, {
      ...(body.code !== undefined && { code: body.code.trim() }),
      ...(body.discountType !== undefined && { discountType: body.discountType }),
      ...(body.discountValue !== undefined && {
        discountValue: new Prisma.Decimal(body.discountValue),
      }),
      ...(body.minOrderValue !== undefined && {
        minOrderValue: body.minOrderValue != null ? new Prisma.Decimal(body.minOrderValue) : null,
      }),
      ...(body.maxDiscount !== undefined && {
        maxDiscount: body.maxDiscount != null ? new Prisma.Decimal(body.maxDiscount) : null,
      }),
      ...(body.usageLimit !== undefined && { usageLimit: body.usageLimit ?? null }),
      ...(expiresAt !== undefined && { expiresAt }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    });
  }

  static async deleteCoupon(id: string) {
    const tenantId = requireTenantId();
    const existing = await CouponRepository.findById(tenantId, id);
    if (!existing) return throwResponse(404, 'Coupon not found');
    await CouponRepository.softDelete(id);
  }

  static async listCoupons() {
    return CouponRepository.listCoupons(requireTenantId());
  }

  /** Public: returns the coupon only if it is genuinely usable right now. */
  static async validateCoupon(code: string) {
    const coupon = await CouponRepository.findByCode(requireTenantId(), code);
    if (!coupon) return throwResponse(404, 'Coupon not found');
    this.assertUsable(coupon);
    return coupon;
  }

  /**
   * Throws unless the coupon can be applied: active, not expired, under its
   * usage cap, and — when `subtotal` is given — over its minimum order value.
   */
  static assertUsable(coupon: Coupon, subtotal?: Prisma.Decimal): void {
    if (!coupon.isActive) return throwResponse(400, 'This coupon is no longer active');
    if (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) {
      return throwResponse(400, 'This coupon has expired');
    }
    if (coupon.usageLimit != null && coupon.usageCount >= coupon.usageLimit) {
      return throwResponse(400, 'This coupon has reached its usage limit');
    }
    if (
      subtotal &&
      coupon.minOrderValue &&
      subtotal.lessThan(new Prisma.Decimal(coupon.minOrderValue as Prisma.Decimal.Value))
    ) {
      return throwResponse(
        400,
        `Order must be at least ${coupon.minOrderValue.toString()} to use this coupon`,
      );
    }
  }
}
