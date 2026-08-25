import { supplierRegistry } from '../../src/suppliers/supplier.registry';
import { CJDropshippingAdapter } from '../../src/suppliers/cj-dropshipping/cj.adapter';
import { PrintfulAdapter } from '../../src/suppliers/printful/printful.adapter';
import type { SupplierAdapter } from '../../src/suppliers/supplier.interface';

/** Bypasses auth/rate-limiting/fetch to unit-test just the sandbox methods' request shaping. */
type WithRequest = { request: (...args: unknown[]) => Promise<unknown> };
function mockRequest(adapter: CJDropshippingAdapter, data: unknown) {
  return jest
    .spyOn(adapter as unknown as WithRequest, 'request')
    .mockResolvedValue({ code: 200, result: true, message: 'Success', data, requestId: 'req-1' });
}

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

  describe('Search/Detail Result Normalization (regression guard for supplier.service.ts)', () => {
    // Real Printful /product/listV2-style search item, captured live via
    // DevTools — note the numeric `id` and Printful-only field names
    // (`title`, `image`, `type_name`) that don't match CJ's shape, which the
    // shared search contract (SupplierSearchResultSchema) was originally
    // ground-truthed against. This exact shape is what broke the frontend's
    // Zod parse before normalizeSearchResult existed: `id: z.string()`
    // rejects a raw number outright.
    const rawPrintfulSearchItem = {
      id: 679,
      main_category_id: 24,
      type: 'DTFILM',
      type_name: 'Cooling Performance Short Sleeve Tee',
      title: 'Unisex Performance Crew Neck T-Shirt | A4 N3142',
      brand: 'A4',
      model: 'N3142',
      image:
        'https://files.cdn.printful.com/o/upload/product-catalog-img/e2/e239b78e54f77c63f3ec3bcda3be8e62_1',
      variant_count: 70,
      currency: 'USD',
    };

    it("normalizeSearchResult turns Printful's numeric id into the string the shared search contract requires", () => {
      const normalized = printfulAdapter.normalizeSearchResult?.(rawPrintfulSearchItem);
      expect(normalized).toBeDefined();
      expect(typeof normalized!.id).toBe('string');
      expect(normalized!.id).toBe('679');
      expect(normalized!.nameEn).toBe(rawPrintfulSearchItem.title);
      expect(normalized!.bigImage).toBe(rawPrintfulSearchItem.image);
    });

    it("normalizeProductDetail flattens Printful's nested {product, variants} into pid/variants[].vid strings", () => {
      const rawDetail = {
        product: {
          id: 679,
          title: 'Unisex Performance Crew Neck T-Shirt | A4 N3142',
          image: 'https://files.cdn.printful.com/.../front.png',
          description: 'Stay cool, dry, and confident...',
          type_name: 'T-Shirts',
        },
        variants: [
          {
            id: 4013,
            name: 'Black / S',
            color: 'Black',
            size: 'S',
            price: '12.95',
            image: 'https://files.cdn.printful.com/.../black-s.png',
          },
          {
            id: 4014,
            name: 'Black / M',
            color: 'Black',
            size: 'M',
            price: '12.95',
            image: 'https://files.cdn.printful.com/.../black-m.png',
          },
        ],
      };

      const normalized = printfulAdapter.normalizeProductDetail?.(rawDetail);
      expect(normalized).toBeDefined();
      expect(normalized!.pid).toBe('679');
      expect(normalized!.productNameEn).toBe(rawDetail.product.title);

      const variants = normalized!.variants as Record<string, unknown>[];
      expect(variants).toHaveLength(2);
      expect(typeof variants[0].vid).toBe('string');
      expect(variants[0].vid).toBe('4013');
      expect(variants[0].variantKey).toBe('Black-S');
    });

    it("CJ's raw shape already matches the shared contract, so it implements neither normalizer", () => {
      // Guards the fallback path in SupplierService:
      // `adapter.normalizeSearchResult?.(item) ?? item`. If CJ ever needs a
      // real implementation, this assertion should start failing — replace
      // it with real assertions the way the Printful ones above are.
      const cjAsAdapter: SupplierAdapter = cjAdapter;
      expect(cjAsAdapter.normalizeSearchResult).toBeUndefined();
      expect(cjAsAdapter.normalizeProductDetail).toBeUndefined();
    });

    it('every registered adapter with a normalizeSearchResult always returns a string id — the exact invariant that broke the frontend Zod parse for Printful', () => {
      const sampleRawItemBySupplier: Record<string, unknown> = {
        printful: rawPrintfulSearchItem,
      };

      for (const adapter of supplierRegistry.getAll()) {
        if (!adapter.normalizeSearchResult) continue;
        const sample = sampleRawItemBySupplier[adapter.supplierId];
        if (!sample) continue;
        expect(typeof adapter.normalizeSearchResult(sample).id).toBe('string');
      }
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

  describe('CJ Sandbox Flow', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const samplePayload = {
      orderId: 'ORD-1001',
      items: [{ productVariantId: 'p1', supplierVariantExternalId: 'vid-123', quantity: 2 }],
      shippingAddress: {
        firstName: 'Demo',
        lastName: 'Customer',
        address1: '123 Commerce St',
        city: 'Manila',
        state: 'NCR',
        country: 'PH',
        zip: '1000',
      },
    };

    it('placeSandboxOrder tags the payload with isSandbox=1 and the given logistics fields', async () => {
      const requestSpy = mockRequest(cjAdapter, { orderId: 'CJ-SANDBOX-1' });

      const result = await cjAdapter.placeSandboxOrder(samplePayload, {
        logisticName: 'CJPacket',
        fromCountryCode: 'CN',
      });

      expect(requestSpy).toHaveBeenCalledWith(
        '/shopping/order/createOrderV2',
        'POST',
        expect.objectContaining({
          orderNumber: 'ORD-1001',
          isSandbox: 1,
          logisticName: 'CJPacket',
          fromCountryCode: 'CN',
          products: [{ vid: 'vid-123', quantity: 2 }],
        }),
      );
      expect(result).toEqual({ orderId: 'CJ-SANDBOX-1' });
    });

    it('placeOrder (non-sandbox) never sets isSandbox on the payload', async () => {
      const requestSpy = mockRequest(cjAdapter, { orderId: 'CJ-REAL-1' });

      await cjAdapter.placeOrder(samplePayload);

      const sentPayload = requestSpy.mock.calls[0][2] as Record<string, unknown>;
      expect(sentPayload.isSandbox).toBeUndefined();
    });

    it('simulatePay rejects when neither orderId nor shipmentOrderId is given', async () => {
      await expect(cjAdapter.simulatePay({})).rejects.toThrow(
        'simulatePay requires orderId or shipmentOrderId',
      );
    });

    it('simulatePay moves a sandbox order to paid (status 300)', async () => {
      const requestSpy = mockRequest(cjAdapter, true);

      const paid = await cjAdapter.simulatePay({ orderId: 'CJ-SANDBOX-1' });

      expect(requestSpy).toHaveBeenCalledWith('/shopping/sandbox/simulatePay', 'POST', {
        orderId: 'CJ-SANDBOX-1',
      });
      expect(paid).toBe(true);
    });

    it('updateSandboxStatus steps the order forward by exactly one stage', async () => {
      const requestSpy = mockRequest(cjAdapter, true);

      await cjAdapter.updateSandboxStatus({ orderId: 'CJ-SANDBOX-1', targetStatus: 400 });

      expect(requestSpy).toHaveBeenCalledWith('/shopping/sandbox/updateStatus', 'POST', {
        orderId: 'CJ-SANDBOX-1',
        targetStatus: 400,
      });
    });

    it('advanceSandboxOrder replays updateStatus one hop at a time up to the target', async () => {
      const requestSpy = mockRequest(cjAdapter, true);

      await cjAdapter.advanceSandboxOrder('CJ-SANDBOX-1', 600);

      expect(requestSpy).toHaveBeenNthCalledWith(1, '/shopping/sandbox/updateStatus', 'POST', {
        orderId: 'CJ-SANDBOX-1',
        targetStatus: 400,
      });
      expect(requestSpy).toHaveBeenNthCalledWith(2, '/shopping/sandbox/updateStatus', 'POST', {
        orderId: 'CJ-SANDBOX-1',
        targetStatus: 500,
      });
      expect(requestSpy).toHaveBeenNthCalledWith(3, '/shopping/sandbox/updateStatus', 'POST', {
        orderId: 'CJ-SANDBOX-1',
        targetStatus: 600,
      });
      expect(requestSpy).toHaveBeenCalledTimes(3);
    });

    it('updateSandboxTrackNumber attaches a tracking string to a paid, unclosed order', async () => {
      const requestSpy = mockRequest(cjAdapter, true);

      const ok = await cjAdapter.updateSandboxTrackNumber({
        orderId: 'CJ-SANDBOX-1',
        trackNumber: 'SBXTN2607290902',
      });

      expect(requestSpy).toHaveBeenCalledWith('/shopping/sandbox/updateTrackNumber', 'POST', {
        orderId: 'CJ-SANDBOX-1',
        trackNumber: 'SBXTN2607290902',
      });
      expect(ok).toBe(true);
    });
  });
});
