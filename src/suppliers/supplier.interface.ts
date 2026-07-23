import { SupplierOrder, SupplierProduct } from '@prisma/client';

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
 */
export interface SupplierAdapter {
  /**
   * The ID of this supplier in our database (e.g., 'cj-dropshipping').
   */
  readonly supplierId: string;

  /**
   * Search for products on the supplier's platform.
   */
  searchProducts(query: string): Promise<any[]>;

  /**
   * Fetch full details for a specific external product ID.
   */
  getProduct(externalId: string): Promise<any>;

  /**
   * Get current stock levels for a batch of external variant IDs.
   */
  getInventory(externalVariantIds: string[]): Promise<SupplierStock[]>;

  /**
   * Place an order with the supplier.
   */
  placeOrder(payload: PlaceOrderPayload): Promise<any>;

  /**
   * Check the status of an already placed order.
   */
  getOrderStatus(externalOrderId: string): Promise<any>;
}
