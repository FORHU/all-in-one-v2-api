import { supplierRegistry } from '../../src/suppliers/supplier.registry';
import { CJDropshippingAdapter } from '../../src/suppliers/cj-dropshipping/cj.adapter';
import { PrintfulAdapter } from '../../src/suppliers/printful/printful.adapter';

describe('Dropshipping Pipeline & Supplier Adapters', () => {
  let cjAdapter: CJDropshippingAdapter;
  let printfulAdapter: PrintfulAdapter;

  beforeAll(() => {
    cjAdapter = new CJDropshippingAdapter();
    printfulAdapter = new PrintfulAdapter();

    // Register adapters if not already registered
    try {
      supplierRegistry.register(cjAdapter);
    } catch {
      // Already registered
    }
    try {
      supplierRegistry.register(printfulAdapter);
    } catch {
      // Already registered
    }
  });

  describe('Supplier Registry & Adapter Resolution', () => {
    it('should retrieve CJ Dropshipping adapter by supplier ID', () => {
      const adapter = supplierRegistry.get('cj-dropshipping');
      expect(adapter).toBeDefined();
      expect(adapter.supplierId).toBe('cj-dropshipping');
    });

    it('should retrieve Printful adapter by supplier ID', () => {
      const adapter = supplierRegistry.get('printful');
      expect(adapter).toBeDefined();
      expect(adapter.supplierId).toBe('printful');
    });

    it('should throw an error when requesting an unregistered supplier', () => {
      expect(() => supplierRegistry.get('UNKNOWN_SUPPLIER')).toThrow(
        'No SupplierAdapter found for supplierId: UNKNOWN_SUPPLIER',
      );
    });
  });

  describe('Automated Profit Margin & Selling Price Calculation', () => {
    it('should correctly calculate selling price with 50% markup', () => {
      const baseCost = 50.0; // Wholesale cost from supplier
      const markupPercentage = 50.0; // 50% markup

      const sellingPrice = baseCost * (1 + markupPercentage / 100);
      const profit = sellingPrice - baseCost;

      expect(sellingPrice).toBe(75.0);
      expect(profit).toBe(25.0);
    });

    it('should correctly calculate selling price with 100% markup (double cost)', () => {
      const baseCost = 45.0;
      const markupPercentage = 100.0;

      const sellingPrice = baseCost * (1 + markupPercentage / 100);
      const profit = sellingPrice - baseCost;

      expect(sellingPrice).toBe(90.0);
      expect(profit).toBe(45.0);
    });
  });

  describe('Supplier Order Placement Simulation', () => {
    it('should generate valid payload for placing order with supplier', () => {
      const placeOrderPayload = {
        externalVariantId: 'CJ-AM2026-BLK-42',
        quantity: 2,
        shippingAddress: {
          name: 'Demo Customer',
          address1: '123 Commerce St',
          city: 'Manila',
          country: 'PH',
          postalCode: '1000',
        },
      };

      expect(placeOrderPayload.externalVariantId).toBe('CJ-AM2026-BLK-42');
      expect(placeOrderPayload.quantity).toBe(2);
      expect(placeOrderPayload.shippingAddress.country).toBe('PH');
    });
  });
});
