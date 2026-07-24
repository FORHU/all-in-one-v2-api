import Bottleneck from 'bottleneck';
import CacheUtil from '../../utils/cache.util';
import logger from '../../utils/logger';
import { PlaceOrderPayload, SupplierAdapter, SupplierStock } from '../supplier.interface';
import { CJ_API_KEY, CJ_BASE_URL, CJ_RATE_LIMIT_MS } from '../../config';
import { CJApiResponse, CJTokenData, CJProductDetail, CJVariant, CJProduct } from './cj.types';

const CACHE_VERSION = 'v1';
const CJ_ACCESS_TOKEN_KEY = `cj:access_token:${CACHE_VERSION}`;
const CJ_REFRESH_TOKEN_KEY = `cj:refresh_token:${CACHE_VERSION}`;

const DEFAULT_ACCESS_TOKEN_TTL = 14 * 24 * 60 * 60; // 14 days
const DEFAULT_REFRESH_TOKEN_TTL = 170 * 24 * 60 * 60; // 170 days

function calculateTTL(expiryDateStr: string | undefined, defaultTTL: number): number {
  if (!expiryDateStr) return defaultTTL;
  try {
    const expiryDate = new Date(expiryDateStr).getTime();
    const now = Date.now();
    const ttlMs = expiryDate - now;
    return ttlMs > 3600000 ? Math.floor(ttlMs / 1000) : defaultTTL;
  } catch {
    return defaultTTL;
  }
}

export class CJDropshippingAdapter implements SupplierAdapter {
  readonly supplierId = 'cj-dropshipping';

  private limiter = new Bottleneck({
    minTime: CJ_RATE_LIMIT_MS,
    maxConcurrent: 1,
  });

  constructor() {
    this.limiter.on('queued', () => {
      const queued = this.limiter.queued();
      if (queued > 5) {
        logger.warn(`[CJDropshippingAdapter] ${queued} requests queued - expect delays`);
      }
    });
  }

  // --- Authentication ---

  private async getAccessToken(): Promise<string | null> {
    try {
      const accessToken = await CacheUtil.get<string>(CJ_ACCESS_TOKEN_KEY);
      if (accessToken) return accessToken;

      const refreshToken = await CacheUtil.get<string>(CJ_REFRESH_TOKEN_KEY);
      if (refreshToken) {
        const refreshed = await this.refreshAccessToken(refreshToken);
        if (refreshed) return refreshed;
      }

      const tokens = await this.authenticate();
      return tokens?.accessToken || null;
    } catch (error) {
      logger.error('[CJDropshippingAdapter:getAccessToken] Failed:', error);
      return null;
    }
  }

  private async authenticate(): Promise<CJTokenData | null> {
    try {
      if (!CJ_API_KEY) {
        logger.error('[CJDropshippingAdapter:authenticate] CJ_API_KEY is not configured');
        return null;
      }

      const response = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: CJ_API_KEY }),
      });
      const result: CJApiResponse<CJTokenData> = await response.json();

      if (!result.result || result.code !== 200) {
        logger.error('[CJDropshippingAdapter:authenticate] Failed:', result.message);
        return null;
      }

      const accessTTL = calculateTTL(result.data.accessTokenExpiryDate, DEFAULT_ACCESS_TOKEN_TTL);
      const refreshTTL = calculateTTL(
        result.data.refreshTokenExpiryDate,
        DEFAULT_REFRESH_TOKEN_TTL,
      );

      await CacheUtil.set(CJ_ACCESS_TOKEN_KEY, result.data.accessToken, accessTTL);
      await CacheUtil.set(CJ_REFRESH_TOKEN_KEY, result.data.refreshToken, refreshTTL);

      return result.data;
    } catch (error) {
      logger.error('[CJDropshippingAdapter:authenticate] Error:', error);
      return null;
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<string | null> {
    try {
      const response = await fetch(`${CJ_BASE_URL}/authentication/refreshAccessToken`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const result: CJApiResponse<CJTokenData> = await response.json();

      if (!result.result || result.code !== 200) {
        await CacheUtil.del(CJ_ACCESS_TOKEN_KEY);
        await CacheUtil.del(CJ_REFRESH_TOKEN_KEY);
        return null;
      }

      const accessTTL = calculateTTL(result.data.accessTokenExpiryDate, DEFAULT_ACCESS_TOKEN_TTL);
      const refreshTTL = calculateTTL(
        result.data.refreshTokenExpiryDate,
        DEFAULT_REFRESH_TOKEN_TTL,
      );

      await CacheUtil.set(CJ_ACCESS_TOKEN_KEY, result.data.accessToken, accessTTL);
      await CacheUtil.set(CJ_REFRESH_TOKEN_KEY, result.data.refreshToken, refreshTTL);

      return result.data.accessToken;
    } catch (error) {
      logger.error('[CJDropshippingAdapter:refreshAccessToken] Error:', error);
      return null;
    }
  }

  // --- Base Request ---

  private async request<T = unknown>(
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE' = 'GET',
    data?: unknown,
    queryParams?: Record<string, string | number | undefined>,
  ): Promise<CJApiResponse<T> | null> {
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const accessToken = await this.getAccessToken();
        if (!accessToken) throw new Error('No access token available');

        let url = `${CJ_BASE_URL}${endpoint}`;
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

        const options: RequestInit = {
          method,
          headers: {
            'Content-Type': 'application/json',
            'CJ-Access-Token': accessToken,
          },
        };

        if (data && (method === 'POST' || method === 'PATCH')) {
          options.body = JSON.stringify(data);
        }

        const result = await this.limiter.schedule(async () => {
          const res = await fetch(url, options);

          let retryAfterMs: number | undefined;
          const retryAfter = res.headers.get('Retry-After');
          if (retryAfter) retryAfterMs = parseInt(retryAfter) * 1000;

          if (res.status === 429) {
            const err = new Error(`CJ_RATE_LIMIT: HTTP 429`) as Error & { retryAfterMs?: number };
            err.retryAfterMs = retryAfterMs;
            throw err;
          }

          if (!res.ok) throw new Error(`HTTP Error ${res.status}: ${res.statusText}`);

          const json: CJApiResponse<T> = await res.json();
          if (json.code === 1600200 || json.message?.includes('exceeds limit')) {
            const err = new Error(`CJ_RATE_LIMIT: ${json.message}`) as Error & {
              retryAfterMs?: number;
            };
            err.retryAfterMs = retryAfterMs;
            throw err;
          }

          return json;
        });

        if (!result.result || result.code !== 200) {
          logger.error(`[CJDropshippingAdapter] API error for ${endpoint}:`, result.message);
        }

        return result;
      } catch (error: unknown) {
        const err = error as Error & { retryAfterMs?: number };
        if (err.message?.includes('CJ_RATE_LIMIT') && attempt < maxRetries) {
          const backoffDelay = err.retryAfterMs || Math.pow(2, attempt - 1) * 5000;
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
          continue;
        }
        if (attempt >= maxRetries) throw error;
      }
    }
    return null;
  }

  // --- SupplierAdapter Implementation ---

  async searchProducts(query: string): Promise<CJProduct[]> {
    const res = await this.request<Record<string, unknown>>('/product/listV2', 'GET', undefined, {
      keyWord: query,
      page: 1,
      size: 20,
    });

    if (!res || !res.data) return [];

    // CJ returns nested content sometimes
    let list: CJProduct[] = [];
    if (Array.isArray(res.data.list)) list = res.data.list as CJProduct[];
    else if (res.data.content) {
      const content = res.data.content as Record<string, unknown> | Array<unknown>;
      if (Array.isArray(content)) {
        list = content.flatMap(
          (c) => (c as Record<string, unknown>).productList || c,
        ) as CJProduct[];
      } else if ((content as Record<string, unknown>).productList) {
        list = (content as Record<string, unknown>).productList as CJProduct[];
      }
    }
    return list;
  }

  async getProduct(externalId: string): Promise<CJProductDetail | null> {
    const res = await this.request<CJProductDetail>('/product/query', 'GET', undefined, {
      pid: externalId,
    });
    return res?.data || null;
  }

  async getInventory(externalVariantIds: string[]): Promise<SupplierStock[]> {
    // Note: CJ doesn't have a bulk inventory endpoint by default, we have to fetch per variant or via product
    // For this prototype, we'll fetch them individually, but in prod we'd optimize.
    const stocks: SupplierStock[] = [];
    for (const vid of externalVariantIds) {
      try {
        const res = await this.request<CJVariant>('/product/variant/query', 'GET', undefined, {
          vid,
        });
        if (res?.data) {
          stocks.push({
            externalId: res.data.vid,
            stock: 999, // CJ often relies on a dedicated inventory call or we use 999 if available
          });
        }
      } catch (e) {
        logger.error(`[CJDropshippingAdapter] getInventory error for vid ${vid}`);
      }
    }
    return stocks;
  }

  async placeOrder(payload: PlaceOrderPayload): Promise<unknown> {
    // Maps canonical payload to CJ's payload
    const cjPayload = {
      orderNumber: payload.orderId,
      shippingCountryCode: payload.shippingAddress.country,
      shippingCountry: payload.shippingAddress.country,
      shippingProvince: payload.shippingAddress.state,
      shippingCity: payload.shippingAddress.city,
      shippingAddress: payload.shippingAddress.address1,
      shippingAddress2: payload.shippingAddress.address2 || '',
      shippingCustomerName: `${payload.shippingAddress.firstName} ${payload.shippingAddress.lastName}`,
      shippingZip: payload.shippingAddress.zip,
      shippingPhone: payload.shippingAddress.phone || '0000000000',
      products: payload.items.map((item) => ({
        vid: item.supplierVariantExternalId,
        quantity: item.quantity,
      })),
    };

    const res = await this.request('/shopping/order/createOrderV2', 'POST', cjPayload);
    return res?.data;
  }

  async getOrderStatus(externalOrderId: string): Promise<unknown> {
    const res = await this.request('/shopping/order/getOrderDetail', 'GET', undefined, {
      orderId: externalOrderId,
    });
    return res?.data;
  }
}
