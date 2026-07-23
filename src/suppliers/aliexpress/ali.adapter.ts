import { PlaceOrderPayload, SupplierAdapter, SupplierStock } from '../supplier.interface';

export class AliExpressAdapter implements SupplierAdapter {
  readonly supplierId = 'aliexpress';

  async searchProducts(query: string): Promise<any[]> {
    // TODO: Implement AliExpress API call
    return [];
  }

  async getProduct(externalId: string): Promise<any> {
    // TODO: Implement AliExpress API call
    return {};
  }

  async getInventory(externalVariantIds: string[]): Promise<SupplierStock[]> {
    // TODO: Implement AliExpress API call
    return [];
  }

  async placeOrder(payload: PlaceOrderPayload): Promise<any> {
    // TODO: Implement AliExpress API call
    return {};
  }

  async getOrderStatus(externalOrderId: string): Promise<any> {
    // TODO: Implement AliExpress API call
    return {};
  }
}
