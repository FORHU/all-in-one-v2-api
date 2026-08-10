import { supplierRegistry } from './supplier.registry';
import { CJDropshippingAdapter } from './cj-dropshipping/cj.adapter';
import { AliExpressAdapter } from './aliexpress/ali.adapter';
import { PrintfulAdapter } from './printful/printful.adapter';

/**
 * Registers every supplier adapter into the shared registry. Must run once
 * at startup, before anything calls supplierRegistry.get()/getAll() (e.g.
 * SupplierService) — otherwise the registry is empty and every lookup
 * throws "No SupplierAdapter found for supplierId: ...".
 */
export function registerSuppliers() {
  supplierRegistry.register(new CJDropshippingAdapter());
  supplierRegistry.register(new AliExpressAdapter());
  supplierRegistry.register(new PrintfulAdapter());
}
