import { PlaceOrderPayload, SupplierAdapter, SupplierStock } from '../supplier.interface';

export class AliExpressAdapter implements SupplierAdapter {
  readonly supplierId = 'aliexpress';

  async searchProducts(
    _query: string,
    _page: number,
    _limit: number,
  ): Promise<{ items: unknown[]; total: number }> {
    // TODO: Implement AliExpress API call
    return { items: [], total: 0 };
  }

  async getProduct(_externalId: string): Promise<unknown> {
    // TODO: Implement AliExpress API call
    return {};
  }

  async getInventory(_externalVariantIds: string[]): Promise<SupplierStock[]> {
    // TODO: Implement AliExpress API call
    return [];
  }

  async placeOrder(_payload: PlaceOrderPayload): Promise<unknown> {
    // TODO: Implement AliExpress API call
    return {};
  }

  async getOrderStatus(_externalOrderId: string): Promise<unknown> {
    // TODO: Implement AliExpress API call
    return {};
  }
}
