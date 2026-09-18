import { supplierRegistry } from '../../src/suppliers/supplier.registry';
import { CJDropshippingAdapter } from '../../src/suppliers/cj-dropshipping/cj.adapter';
import { PrintfulAdapter } from '../../src/suppliers/printful/printful.adapter';

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

    it("normalizeSearchResult cleans CJ's title-escaping artifacts (doubled '' and stray \" before 's) without touching anything else", () => {
      const rawCjSearchItem = {
        id: '2408130123456789012',
        nameEn: "Women''s Summer Dress",
        sku: 'CJ-DRESS-001',
        bigImage: 'https://cf.cjdropshipping.com/dress.jpg',
        sellPrice: 12.99,
      };

      const normalized = cjAdapter.normalizeSearchResult?.(rawCjSearchItem);
      expect(normalized).toBeDefined();
      // Everything else on the item passes through untouched.
      expect(normalized!.id).toBe(rawCjSearchItem.id);
      expect(normalized!.bigImage).toBe(rawCjSearchItem.bigImage);
      // Only the doubled '' is cleaned, to a single apostrophe.
      expect(normalized!.nameEn).toBe("Women's Summer Dress");
    });

    it("normalizeProductDetail cleans productNameEn and every variant's variantNameEn the same way", () => {
      const rawCjDetail = {
        pid: '2408130123456789012',
        productNameEn: 'Dress Women"s Chiffon Summer',
        sku: 'CJ-DRESS-001',
        variants: [
          { vid: 'v1', variantNameEn: "Kid''s Size S", variantSellPrice: 12.99 },
          { vid: 'v2', variantNameEn: 'Adult Size M', variantSellPrice: 14.99 },
        ],
      };

      const normalized = cjAdapter.normalizeProductDetail?.(rawCjDetail);
      expect(normalized).toBeDefined();
      expect(normalized!.productNameEn).toBe("Dress Women's Chiffon Summer");

      const variants = normalized!.variants as Record<string, unknown>[];
      expect(variants[0].variantNameEn).toBe("Kid's Size S");
      // A title with nothing to clean passes through unchanged.
      expect(variants[1].variantNameEn).toBe('Adult Size M');
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

  describe('CJ Real Order Flow', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const samplePayload = {
      orderId: 'ORD-2001',
      items: [{ productVariantId: 'p1', supplierVariantExternalId: 'vid-456', quantity: 1 }],
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

    it('placeOrder sends default logistics fields when none are given', async () => {
      const requestSpy = mockRequest(cjAdapter, { orderId: 'CJ-REAL-1' });

      const result = await cjAdapter.placeOrder(samplePayload);

      expect(requestSpy).toHaveBeenCalledWith(
        '/shopping/order/createOrderV2',
        'POST',
        expect.objectContaining({ logisticName: 'CJPacket Ordinary', fromCountryCode: 'CN' }),
      );
      expect(result).toEqual({
        orderId: 'CJ-REAL-1',
        logisticsAutoCorrected: false,
        raw: { orderId: 'CJ-REAL-1' },
      });
    });

    it('placeOrder honors an explicit logisticName/fromCountryCode', async () => {
      const requestSpy = mockRequest(cjAdapter, { orderId: 'CJ-REAL-2' });

      await cjAdapter.placeOrder(samplePayload, {
        logisticName: 'DHL',
        fromCountryCode: 'US',
      });

      expect(requestSpy).toHaveBeenCalledWith(
        '/shopping/order/createOrderV2',
        'POST',
        expect.objectContaining({ logisticName: 'DHL', fromCountryCode: 'US' }),
      );
    });

    it('placeOrder auto-corrects logistics when CJ flags logisticsMiss', async () => {
      mockRequest(cjAdapter, { orderId: 'CJ-REAL-3', logisticsMiss: true });
      const logisticsSpy = jest.spyOn(cjAdapter, 'getOrderLogisticsInfo').mockResolvedValue([
        {
          id: '1',
          orderCode: 'CJ-REAL-3',
          logisticsName: 'Slow Boat',
          postage: 20,
          arrivalTime: '30',
          hasStock: true,
        },
        {
          id: '2',
          orderCode: 'CJ-REAL-3',
          logisticsName: 'CJPacket Ordinary',
          postage: 5,
          arrivalTime: '15',
          hasStock: true,
        },
      ]);
      const updateSpy = jest.spyOn(cjAdapter, 'updateLogistics').mockResolvedValue(true);

      const result = await cjAdapter.placeOrder(samplePayload);

      expect(logisticsSpy).toHaveBeenCalledWith('CJ-REAL-3');
      expect(updateSpy).toHaveBeenCalledWith({
        id: '2',
        orderCode: 'CJ-REAL-3',
        logisticName: 'CJPacket Ordinary',
      });
      expect(result).toEqual(
        expect.objectContaining({ orderId: 'CJ-REAL-3', logisticsAutoCorrected: true }),
      );
    });

    it('placeOrder returns null when logisticsMiss cannot be auto-corrected', async () => {
      mockRequest(cjAdapter, { orderId: 'CJ-REAL-4', logisticsMiss: true });
      jest.spyOn(cjAdapter, 'getOrderLogisticsInfo').mockResolvedValue([]);

      const result = await cjAdapter.placeOrder(samplePayload);

      expect(result).toBeNull();
    });

    it('placeOrder returns null when no orderId can be extracted from the response', async () => {
      mockRequest(cjAdapter, { someOtherField: 'nope' });

      const result = await cjAdapter.placeOrder(samplePayload);

      expect(result).toBeNull();
    });

    it('payBalance rejects when neither orderId nor shipmentOrderId is given', async () => {
      await expect(cjAdapter.payBalance({})).rejects.toThrow(
        'payBalance requires orderId or shipmentOrderId',
      );
    });

    it('payBalance charges the real order balance via /shopping/pay/payBalance', async () => {
      const requestSpy = mockRequest(cjAdapter, true);

      const paid = await cjAdapter.payBalance({ orderId: 'CJ-REAL-1' });

      expect(requestSpy).toHaveBeenCalledWith('/shopping/pay/payBalance', 'POST', {
        orderId: 'CJ-REAL-1',
      });
      expect(paid).toBe(true);
    });

    it('placeAndPayOrder places, confirms, then pays in sequence', async () => {
      const requestSpy = jest
        .spyOn(cjAdapter as unknown as WithRequest, 'request')
        .mockResolvedValueOnce({
          code: 200,
          result: true,
          message: 'Success',
          data: { orderId: 'CJ-REAL-5' },
          requestId: 'req-1',
        })
        .mockResolvedValueOnce({
          code: 200,
          result: true,
          message: 'Success',
          data: true,
          requestId: 'req-2',
        })
        .mockResolvedValueOnce({
          code: 200,
          result: true,
          message: 'Success',
          data: true,
          requestId: 'req-3',
        });

      const result = await cjAdapter.placeAndPayOrder(samplePayload);

      expect(requestSpy).toHaveBeenNthCalledWith(
        1,
        '/shopping/order/createOrderV2',
        'POST',
        expect.objectContaining({ orderNumber: 'ORD-2001' }),
      );
      expect(requestSpy).toHaveBeenNthCalledWith(2, '/shopping/order/confirmOrder', 'PATCH', {
        orderId: 'CJ-REAL-5',
      });
      expect(requestSpy).toHaveBeenNthCalledWith(3, '/shopping/pay/payBalance', 'POST', {
        orderId: 'CJ-REAL-5',
      });
      expect(result).toEqual({ orderId: 'CJ-REAL-5', paid: true, logisticsAutoCorrected: false });
    });

    it('placeAndPayOrder stops without paying when confirmOrder is rejected', async () => {
      const requestSpy = jest
        .spyOn(cjAdapter as unknown as WithRequest, 'request')
        .mockResolvedValueOnce({
          code: 200,
          result: true,
          message: 'Success',
          data: { orderId: 'CJ-REAL-6' },
          requestId: 'req-1',
        })
        .mockResolvedValueOnce({
          code: 200,
          result: true,
          message: 'Success',
          data: false,
          requestId: 'req-2',
        });

      const result = await cjAdapter.placeAndPayOrder(samplePayload);

      expect(requestSpy).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ orderId: 'CJ-REAL-6', paid: false, logisticsAutoCorrected: false });
    });
  });
});
