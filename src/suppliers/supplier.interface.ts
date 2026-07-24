/**
 * Common types for all suppliers to return to the application layer.
 */
export interface PlaceOrderPayload {
  orderId: string;
  items: Array<{
    productVariantId: string;
    supplierVariantExternalId: string;
    quantity: number;
  }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    phone?: string;
    address1: string;
    address2?: string;
    city: string;
    state: string;
    country: string;
    zip: string;
  };
}

export interface SupplierStock {
  externalId: string;
  stock: number;
}

/**
 * The canonical interface all suppliers must implement.
 * Return types are `unknown` to keep the interface supplier-agnostic; each
 * concrete adapter is expected to return a properly typed value that callers
 * can narrow as needed.
 */
export interface SupplierAdapter {
  /**
   * The ID of this supplier in our database (e.g., 'cj-dropshipping').
   */
  readonly supplierId: string;

  /**
   * Search for products on the supplier's platform.
   */
  searchProducts(query: string): Promise<unknown[]>;

  /**
   * Fetch full details for a specific external product ID.
   */
  getProduct(externalId: string): Promise<unknown>;

  /**
   * Get current stock levels for a batch of external variant IDs.
   */
  getInventory(externalVariantIds: string[]): Promise<SupplierStock[]>;

  /**
   * Place an order with the supplier.
   */
  placeOrder(payload: PlaceOrderPayload): Promise<unknown>;

  /**
   * Check the status of an already placed order.
   */
  getOrderStatus(externalOrderId: string): Promise<unknown>;
}
