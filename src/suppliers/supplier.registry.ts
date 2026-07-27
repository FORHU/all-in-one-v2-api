import { SupplierAdapter } from './supplier.interface';

/**
 * A registry to hold and retrieve supplier adapter instances.
 */
class SupplierRegistry {
  private adapters: Map<string, SupplierAdapter> = new Map();

  /**
   * Register a new adapter.
   */
  register(adapter: SupplierAdapter) {
    if (this.adapters.has(adapter.supplierId)) {
      throw new Error(`SupplierAdapter for ${adapter.supplierId} is already registered.`);
    }
    this.adapters.set(adapter.supplierId, adapter);
  }

  /**
   * Get an adapter by its ID.
   */
  get(supplierId: string): SupplierAdapter {
    const adapter = this.adapters.get(supplierId);
    if (!adapter) {
      throw new Error(`No SupplierAdapter found for supplierId: ${supplierId}`);
    }
    return adapter;
  }

  /**
   * Retrieve all registered adapters.
   */
  getAll(): SupplierAdapter[] {
    return Array.from(this.adapters.values());
  }
}

// Export a singleton instance of the registry
export const supplierRegistry = new SupplierRegistry();
