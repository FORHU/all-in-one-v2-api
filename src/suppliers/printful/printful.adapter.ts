import Bottleneck from 'bottleneck';
import CacheUtil from '../../utils/cache.util';
import logger from '../../utils/logger';
import { PlaceOrderPayload, SupplierAdapter, SupplierStock } from '../supplier.interface';
import {
  PRINTFUL_API_KEY,
  PRINTFUL_BASE_URL,
  PRINTFUL_STORE_ID,
  PRINTFUL_RATE_LIMIT_MS,
} from '../../config';
import {
  PrintfulApiResponse,
  PrintfulPaginatedResponse,
  PrintfulCatalogProduct,
  PrintfulCatalogProductDetail,
  PrintfulCatalogVariant,
  PrintfulOrder,
  PrintfulCreateOrderParams,
  PrintfulShippingRate,
  PrintfulShippingRateParams,
  PrintfulStore,
  PrintfulFile,
  PrintfulWebhookConfig,
  PrintfulProductTemplate,
} from './printful.types';

const CACHE_VERSION = 'v1';
const PRINTFUL_CATALOG_PRODUCT_KEY = (id: number) => `printful:product:${CACHE_VERSION}:${id}`;
const PRINTFUL_CATALOG_ALL_KEY = `printful:catalog:${CACHE_VERSION}`;
const CATALOG_TTL = 24 * 60 * 60; // 24 hours — catalog is slow-changing

/**
 * Adapter for the Printful Print-on-Demand API (V1).
 * Docs: https://developers.printful.com/docs
 *
 * Authentication: Bearer token via Authorization header.
 * Rate limiting: ~120 requests/min, managed by Bottleneck.
 */
export class PrintfulAdapter implements SupplierAdapter {
  readonly supplierId = 'printful';

  private limiter = new Bottleneck({
    minTime: PRINTFUL_RATE_LIMIT_MS,
    maxConcurrent: 2,
  });

  constructor() {
    this.limiter.on('queued', () => {
      const queued = this.limiter.queued();
      if (queued > 10) {
        logger.warn(`[PrintfulAdapter] ${queued} requests queued – expect delays`);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // Base Request
  // ---------------------------------------------------------------------------

  private async request<T = unknown>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    body?: unknown,
    queryParams?: Record<string, string | number | boolean | undefined>,
  ): Promise<T> {
    if (!PRINTFUL_API_KEY) {
      throw new Error('[PrintfulAdapter] PRINTFUL_API_KEY is not configured');
    }

    let url = `${PRINTFUL_BASE_URL}${endpoint}`;
    if (queryParams && method === 'GET') {
      const params = new URLSearchParams();
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, String(value));
        }
      });
      const qs = params.toString();
      if (qs) url += `?${qs}`;
    }

    return this.limiter.schedule(async () => {
      const headers: Record<string, string> = {
        Authorization: `Bearer ${PRINTFUL_API_KEY}`,
        'Content-Type': 'application/json',
      };

      // Store-scoped requests require X-PF-Store-ID header
      if (PRINTFUL_STORE_ID) {
        headers['X-PF-Store-ID'] = PRINTFUL_STORE_ID;
      }

      const options: RequestInit = { method, headers };
      if (body && (method === 'POST' || method === 'PUT')) {
        options.body = JSON.stringify(body);
      }

      const res = await fetch(url, options);

      if (res.status === 429) {
        const retryAfter = res.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 60000;
        const err = new Error('PRINTFUL_RATE_LIMIT: HTTP 429') as Error & { retryAfterMs: number };
        err.retryAfterMs = delay;
        throw err;
      }

      if (!res.ok) {
        const errorBody = await res.text().catch(() => res.statusText);
        throw new Error(`[PrintfulAdapter] HTTP ${res.status}: ${errorBody}`);
      }

      return res.json() as Promise<T>;
    });
  }

  // ---------------------------------------------------------------------------
  // SupplierAdapter — required interface methods
  // ---------------------------------------------------------------------------

  /**
   * Search Printful's catalog for products matching a query string.
   * Results are cached for 24 hours to avoid hammering the catalog API.
   */
  async searchProducts(query: string): Promise<PrintfulCatalogProduct[]> {
    try {
      const cached = await CacheUtil.get<PrintfulCatalogProduct[]>(PRINTFUL_CATALOG_ALL_KEY);
      const catalog = cached ?? (await this.getCatalog());

      if (!catalog) return [];

      const lq = query.toLowerCase();
      return catalog.filter(
        (p) =>
          p.title.toLowerCase().includes(lq) ||
          p.type_name.toLowerCase().includes(lq) ||
          p.brand?.toLowerCase().includes(lq) ||
          p.model?.toLowerCase().includes(lq),
      );
    } catch (error) {
      logger.error('[PrintfulAdapter:searchProducts] Error:', error);
      return [];
    }
  }

  /**
   * Fetch a single catalog product with all its variants.
   */
  async getProduct(externalId: string): Promise<PrintfulCatalogProductDetail | null> {
    const numericId = parseInt(externalId, 10);
    if (isNaN(numericId)) {
      logger.error(`[PrintfulAdapter:getProduct] Invalid product ID: ${externalId}`);
      return null;
    }

    try {
      const cacheKey = PRINTFUL_CATALOG_PRODUCT_KEY(numericId);
      const cached = await CacheUtil.get<PrintfulCatalogProductDetail>(cacheKey);
      if (cached) return cached;

      const res = await this.request<PrintfulApiResponse<PrintfulCatalogProductDetail>>(
        `/products/${numericId}`,
      );

      if (!res.result) {
        logger.error(`[PrintfulAdapter:getProduct] No result for product ${numericId}`);
        return null;
      }

      await CacheUtil.set(cacheKey, res.result, CATALOG_TTL);
      return res.result;
    } catch (error) {
      logger.error(`[PrintfulAdapter:getProduct] Error fetching ${externalId}:`, error);
      return null;
    }
  }

  /**
   * Fetch stock for a batch of Printful variant IDs.
   * Printful's V1 catalog exposes `in_stock` per variant; inventory
   * is fulfilled on-demand so stock is treated as unlimited when in_stock=true.
   */
  async getInventory(externalVariantIds: string[]): Promise<SupplierStock[]> {
    const stocks: SupplierStock[] = [];

    for (const vid of externalVariantIds) {
      try {
        const res = await this.request<PrintfulApiResponse<{ variant: PrintfulCatalogVariant }>>(
          `/products/variant/${vid}`,
        );
        if (res.result?.variant) {
          stocks.push({
            externalId: String(res.result.variant.id),
            // Print-on-demand: stock is functionally unlimited when in_stock === true
            stock: res.result.variant.in_stock ? 9999 : 0,
          });
        }
      } catch (error) {
        logger.error(`[PrintfulAdapter:getInventory] Error for variant ${vid}:`, error);
      }
    }

    return stocks;
  }

  /**
   * Create a new order with Printful using the canonical PlaceOrderPayload.
   */
  async placeOrder(payload: PlaceOrderPayload): Promise<PrintfulOrder | null> {
    try {
      const printfulPayload: PrintfulCreateOrderParams = {
        external_id: payload.orderId,
        shipping: 'STANDARD',
        recipient: {
          name: `${payload.shippingAddress.firstName} ${payload.shippingAddress.lastName}`,
          address1: payload.shippingAddress.address1,
          address2: payload.shippingAddress.address2,
          city: payload.shippingAddress.city,
          state_code: payload.shippingAddress.state,
          country_code: payload.shippingAddress.country,
          zip: payload.shippingAddress.zip,
          phone: payload.shippingAddress.phone,
        },
        items: payload.items.map((item) => ({
          sync_variant_id: item.supplierVariantExternalId,
          quantity: item.quantity,
        })),
      };

      const res = await this.request<PrintfulApiResponse<PrintfulOrder>>(
        '/orders',
        'POST',
        printfulPayload,
      );

      if (res.code !== 200) {
        logger.error('[PrintfulAdapter:placeOrder] API error:', res.error?.message);
        return null;
      }

      return res.result;
    } catch (error) {
      logger.error('[PrintfulAdapter:placeOrder] Error:', error);
      return null;
    }
  }

  /**
   * Retrieve the status/details of a previously placed order.
   */
  async getOrderStatus(externalOrderId: string): Promise<PrintfulOrder | null> {
    try {
      const res = await this.request<PrintfulApiResponse<PrintfulOrder>>(
        `/orders/${externalOrderId}`,
      );
      return res.result ?? null;
    } catch (error) {
      logger.error(`[PrintfulAdapter:getOrderStatus] Error for order ${externalOrderId}:`, error);
      return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Printful-specific public methods (beyond the SupplierAdapter interface)
  // ---------------------------------------------------------------------------

  /** Fetch the full Printful catalog, cached for 24 hours. */
  async getCatalog(categoryId?: number): Promise<PrintfulCatalogProduct[]> {
    try {
      const cacheKey = categoryId
        ? `${PRINTFUL_CATALOG_ALL_KEY}:cat:${categoryId}`
        : PRINTFUL_CATALOG_ALL_KEY;
      const cached = await CacheUtil.get<PrintfulCatalogProduct[]>(cacheKey);
      if (cached) return cached;

      const res = await this.request<PrintfulPaginatedResponse<PrintfulCatalogProduct>>(
        '/products',
        'GET',
        undefined,
        categoryId ? { category_id: categoryId } : undefined,
      );

      const products = res.result ?? [];
      await CacheUtil.set(cacheKey, products, CATALOG_TTL);
      return products;
    } catch (error) {
      logger.error('[PrintfulAdapter:getCatalog] Error:', error);
      return [];
    }
  }

  /** Get all categories. */
  async getCategories(): Promise<unknown[]> {
    try {
      const res = await this.request<PrintfulApiResponse<{ categories: unknown[] }>>('/categories');
      return res.result?.categories ?? [];
    } catch (error) {
      logger.error('[PrintfulAdapter:getCategories] Error:', error);
      return [];
    }
  }

  /** Get size guide for a catalog product. */
  async getSizeGuide(productId: number): Promise<unknown | null> {
    try {
      const res = await this.request<PrintfulApiResponse<unknown>>(`/products/${productId}/sizes`);
      return res.result ?? null;
    } catch (error) {
      logger.error(`[PrintfulAdapter:getSizeGuide] Error for product ${productId}:`, error);
      return null;
    }
  }

  /** Calculate shipping rates for a given recipient and items. */
  async calculateShipping(params: PrintfulShippingRateParams): Promise<PrintfulShippingRate[]> {
    try {
      const res = await this.request<PrintfulApiResponse<PrintfulShippingRate[]>>(
        '/shipping/rates',
        'POST',
        params,
      );
      return res.result ?? [];
    } catch (error) {
      logger.error('[PrintfulAdapter:calculateShipping] Error:', error);
      return [];
    }
  }

  /** Get all stores associated with the API token. */
  async getStores(): Promise<PrintfulStore[]> {
    try {
      const res = await this.request<PrintfulApiResponse<PrintfulStore[]>>('/stores');
      return Array.isArray(res.result) ? res.result : [];
    } catch (error) {
      logger.error('[PrintfulAdapter:getStores] Error:', error);
      return [];
    }
  }

  /** Confirm a draft order for fulfillment. */
  async confirmOrder(orderId: number | string): Promise<PrintfulOrder | null> {
    try {
      const res = await this.request<PrintfulApiResponse<PrintfulOrder>>(
        `/orders/${orderId}/confirm`,
        'POST',
      );
      return res.result ?? null;
    } catch (error) {
      logger.error(`[PrintfulAdapter:confirmOrder] Error for order ${orderId}:`, error);
      return null;
    }
  }

  /** Cancel (delete) a draft order. */
  async cancelOrder(orderId: number | string): Promise<boolean> {
    try {
      await this.request(`/orders/${orderId}`, 'DELETE');
      return true;
    } catch (error) {
      logger.error(`[PrintfulAdapter:cancelOrder] Error for order ${orderId}:`, error);
      return false;
    }
  }

  /** Estimate fulfillment costs for an order without submitting it. */
  async estimateOrderCosts(params: PrintfulCreateOrderParams): Promise<unknown | null> {
    try {
      const res = await this.request<PrintfulApiResponse<unknown>>(
        '/orders/estimate-costs',
        'POST',
        params,
      );
      return res.result ?? null;
    } catch (error) {
      logger.error('[PrintfulAdapter:estimateOrderCosts] Error:', error);
      return null;
    }
  }

  /** Add a file to the Printful file library. */
  async addFile(fileData: {
    type?: string;
    url: string;
    filename?: string;
    visible?: boolean;
  }): Promise<PrintfulFile | null> {
    try {
      const res = await this.request<PrintfulApiResponse<{ file: PrintfulFile }>>(
        '/files',
        'POST',
        fileData,
      );
      return res.result?.file ?? null;
    } catch (error) {
      logger.error('[PrintfulAdapter:addFile] Error:', error);
      return null;
    }
  }

  /** Fetch an existing file from the library by ID. */
  async getFile(fileId: number | string): Promise<PrintfulFile | null> {
    try {
      const res = await this.request<PrintfulApiResponse<{ file: PrintfulFile }>>(
        `/files/${fileId}`,
      );
      return res.result?.file ?? null;
    } catch (error) {
      logger.error(`[PrintfulAdapter:getFile] Error for file ${fileId}:`, error);
      return null;
    }
  }

  /** Get current webhook configuration for the store. */
  async getWebhookConfig(): Promise<PrintfulWebhookConfig | null> {
    try {
      const res = await this.request<PrintfulApiResponse<PrintfulWebhookConfig>>('/webhooks');
      return res.result ?? null;
    } catch (error) {
      logger.error('[PrintfulAdapter:getWebhookConfig] Error:', error);
      return null;
    }
  }

  /** Set (overwrite) webhook configuration. */
  async setWebhookConfig(config: PrintfulWebhookConfig): Promise<PrintfulWebhookConfig | null> {
    try {
      const res = await this.request<PrintfulApiResponse<PrintfulWebhookConfig>>(
        '/webhooks',
        'POST',
        config,
      );
      return res.result ?? null;
    } catch (error) {
      logger.error('[PrintfulAdapter:setWebhookConfig] Error:', error);
      return null;
    }
  }

  /** Disable webhook support for the store. */
  async deleteWebhookConfig(): Promise<boolean> {
    try {
      await this.request('/webhooks', 'DELETE');
      return true;
    } catch (error) {
      logger.error('[PrintfulAdapter:deleteWebhookConfig] Error:', error);
      return false;
    }
  }

  /** List product templates. */
  async getProductTemplates(limit = 10, offset = 0): Promise<PrintfulProductTemplate[]> {
    try {
      const res = await this.request<PrintfulApiResponse<{ items: PrintfulProductTemplate[] }>>(
        '/product-templates',
        'GET',
        undefined,
        { limit, offset },
      );
      return res.result?.items ?? [];
    } catch (error) {
      logger.error('[PrintfulAdapter:getProductTemplates] Error:', error);
      return [];
    }
  }

  /** Get a single product template by ID. */
  async getProductTemplate(templateId: number | string): Promise<PrintfulProductTemplate | null> {
    try {
      const res = await this.request<PrintfulApiResponse<{ template: PrintfulProductTemplate }>>(
        `/product-templates/${templateId}`,
      );
      return res.result?.template ?? null;
    } catch (error) {
      logger.error(`[PrintfulAdapter:getProductTemplate] Error for template ${templateId}:`, error);
      return null;
    }
  }

  /** Delete a product template. */
  async deleteProductTemplate(templateId: number | string): Promise<boolean> {
    try {
      await this.request(`/product-templates/${templateId}`, 'DELETE');
      return true;
    } catch (error) {
      logger.error(
        `[PrintfulAdapter:deleteProductTemplate] Error for template ${templateId}:`,
        error,
      );
      return false;
    }
  }
}
