import { SupplierOrderStatus } from '@prisma/client';
import OrderRepository from './order.repository';
import SupplierRepository from '../supplier/supplier.repository';
import { supplierRegistry } from '../../suppliers/supplier.registry';
import { CJDropshippingAdapter } from '../../suppliers/cj-dropshipping/cj.adapter';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';

const CJ_SUPPLIER_NAME = 'cj-dropshipping';

/**
 * Splits a single stored "full name" into the firstName/lastName CJ's
 * createOrderV2 requires — CommerceShippingAddress only stores one
 * `fullName` field (see commerce.prisma), it was never collected as two.
 * A single-word name (e.g. "Cher") is used for both, so neither field is
 * ever empty — a documented simplification, not a silent truncation.
 */
function splitFullName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex === -1) return { firstName: trimmed, lastName: trimmed };
  return {
    firstName: trimmed.slice(0, spaceIndex),
    lastName: trimmed.slice(spaceIndex + 1).trim(),
  };
}

/**
 * Bridges an existing CommerceOrder to a real CJ Dropshipping order. Admin-
 * triggered only (see order.route.ts's POST /:id/place-with-supplier) —
 * nothing calls this from checkout.
 *
 * Deliberately CJ-only and all-or-nothing for this first pass: an order
 * mixing CJ items with items from another supplier (or first-party stock)
 * is rejected outright rather than partially placed. Splitting a
 * mixed-supplier order across multiple supplier placements is future work.
 */
export default class CJOrderFulfillmentService {
  static async placeOrder(orderId: string) {
    const tenantId = requireTenantId();

    const order = await OrderRepository.findById(tenantId, orderId);
    if (!order) {
      return throwResponse(404, 'Order not found');
    }

    const partner = await SupplierRepository.findPartnerByName(CJ_SUPPLIER_NAME);
    if (!partner) {
      return throwResponse(500, `Supplier partner '${CJ_SUPPLIER_NAME}' is not configured`);
    }

    const existing = await OrderRepository.findSupplierOrderForOrder(
      tenantId,
      orderId,
      partner.id,
    );
    if (existing) {
      return throwResponse(
        409,
        `Order ${orderId} was already placed with ${CJ_SUPPLIER_NAME} (supplier order ${existing.id})`,
      );
    }

    if (!order.shippingAddress) {
      return throwResponse(400, 'Order has no shipping address — nothing to ship to');
    }

    const productVariantIds = order.items.map((item) => item.productVariantId);
    const vidByVariantId = await SupplierRepository.findVariantMappingsBySupplier(
      CJ_SUPPLIER_NAME,
      productVariantIds,
    );

    const unmapped = order.items.filter((item) => !vidByVariantId.has(item.productVariantId));
    if (unmapped.length > 0) {
      return throwResponse(
        422,
        `${unmapped.length} item(s) on this order are not sourced from ${CJ_SUPPLIER_NAME}: ` +
          unmapped.map((item) => item.productTitle).join(', '),
      );
    }

    const { firstName, lastName } = splitFullName(order.shippingAddress.fullName);

    const adapter = supplierRegistry.get(CJ_SUPPLIER_NAME) as CJDropshippingAdapter;
    const result = await adapter.placeAndPayOrder({
      orderId: order.orderNumber,
      items: order.items.map((item) => ({
        productVariantId: item.productVariantId,
        // Non-null: every id here passed the `unmapped` check above.
        supplierVariantExternalId: vidByVariantId.get(item.productVariantId) as string,
        quantity: item.quantity,
      })),
      shippingAddress: {
        firstName,
        lastName,
        phone: order.shippingAddress.phone || undefined,
        address1: order.shippingAddress.addressLine1,
        address2: order.shippingAddress.addressLine2 || undefined,
        city: order.shippingAddress.city,
        state: order.shippingAddress.state || '',
        country: order.shippingAddress.country,
        zip: order.shippingAddress.postalCode,
      },
    });

    if (!result) {
      return throwResponse(
        502,
        `${CJ_SUPPLIER_NAME} rejected the order — see server logs for details`,
      );
    }

    // The CJ order now exists (and may already be paid) on their side. If
    // this write fails, that's a real order with no local record of it —
    // flagged, not solved, in this pass (see cj-order-fulfillment plan notes).
    return OrderRepository.createSupplierOrderWithItems(
      tenantId,
      orderId,
      partner.id,
      result.orderId,
      result.paid ? SupplierOrderStatus.CONFIRMED : SupplierOrderStatus.PLACED,
      { logisticsAutoCorrected: result.logisticsAutoCorrected, paid: result.paid },
      order.items.map((item) => item.id),
    );
  }
}
