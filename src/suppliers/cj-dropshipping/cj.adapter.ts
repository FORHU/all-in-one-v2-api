import Bottleneck from 'bottleneck';
import CacheUtil from '../../utils/cache.util';
import logger from '../../utils/logger';
import { PlaceOrderPayload, SupplierAdapter, SupplierStock } from '../supplier.interface';
import { CJ_API_KEY, CJ_BASE_URL, CJ_RATE_LIMIT_MS } from '../../config';
import {
  CJApiResponse,
  CJTokenData,
  CJProductDetail,
  CJProductListV2Data,
  CJProductListV2Item,
  CJVariantStock,
  CJCreateOrderParams,
  CJSandboxTargetStatus,
  CJSimulatePayParams,
  CJUpdateSandboxStatusParams,
  CJUpdateSandboxTrackNumberParams,
  CJLogisticsOption,
  CJUpdateLogisticsParams,
  CJDisputeProduct,
  CJDisputeConfirmInfo,
  CJCreateDisputeParams,
  CJCancelDisputeParams,
  CJDisputeListParams,
  CJDispute,
} from './cj.types';
import { cleanCjText } from './cj.text.util';

/** CJ's sandbox status ladder, in order — see CJSandboxTargetStatus. */
const SANDBOX_STATUS_LADDER: CJSandboxTargetStatus[] = [400, 500, 600, 700];

/**
 * Quotes bare integer literals of 16+ digits before JSON.parse, so they
 * survive as precision-safe strings instead of being silently rounded by
 * standard JSON parsing (which only represents integers exactly up to
 * Number.MAX_SAFE_INTEGER, ~16 digits) — CJ's `id` fields on
 * getOrderLogisticsInfo run to 19 digits. 16 is a deliberately safe
 * threshold: ordinary numeric fields in CJ's responses (prices, counts,
 * timestamps) are far shorter and pass through untouched.
 */
function parseJsonPreservingBigInts(text: string): unknown {
  const safe = text.replace(/([:[,]\s*)(-?\d{16,})(\s*[,}\]])/g, '$1"$2"$3');
  return JSON.parse(safe);
}

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

  async searchProducts(
    query: string,
    page: number,
    limit: number,
  ): Promise<{ items: CJProductListV2Item[]; total: number }> {
    const res = await this.request<CJProductListV2Data>('/product/listV2', 'GET', undefined, {
      keyWord: query,
      page,
      size: limit,
    });

    if (!res?.data) return { items: [], total: 0 };

    // Depending on the requested `size`, CJ returns `content` as either a flat
    // array of products, or a single wrapper object holding `productList`.
    // Returned as-is, trusting CJ's own relevance ranking — a prior local
    // keyword filter here (narrowing to items whose name contained one of the
    // query's words) caused `total`/`totalPages` (built from CJ's per-page,
    // pre-filter `totalRecords`) to disagree with the actual (filtered, thus
    // shorter) `items` array on every page, undercounting or even emptying
    // pages the pager claimed existed.
    const items = (res.data.content ?? []).flatMap((c) => c.productList ?? c);

    return { items, total: res.data.totalRecords ?? 0 };
  }

  async getProduct(externalId: string): Promise<CJProductDetail | null> {
    const res = await this.request<CJProductDetail>('/product/query', 'GET', undefined, {
      pid: externalId,
    });
    return res?.data || null;
  }

  /**
   * Cleans CJ's title text-escaping artifacts (see cleanCjText) on a raw
   * /product/listV2 search result before it reaches the sourcing UI —
   * otherwise the preview-before-import search list shows the same garbled
   * "Women"s Summer..." titles ProductImportService.normalizeCjProduct
   * already cleans up at actual import time.
   */
  normalizeSearchResult(raw: unknown): Record<string, unknown> {
    const item = raw as CJProductListV2Item;
    return {
      ...item,
      nameEn: typeof item.nameEn === 'string' ? cleanCjText(item.nameEn) : item.nameEn,
    };
  }

  /** Same idea as normalizeSearchResult, for the /product/query detail payload the "preview before import" panel reads. */
  normalizeProductDetail(raw: unknown): Record<string, unknown> {
    const detail = raw as CJProductDetail;
    return {
      ...detail,
      productNameEn:
        typeof detail.productNameEn === 'string'
          ? cleanCjText(detail.productNameEn)
          : detail.productNameEn,
      variants: Array.isArray(detail.variants)
        ? detail.variants.map((v) => ({
            ...v,
            variantNameEn:
              typeof v.variantNameEn === 'string' ? cleanCjText(v.variantNameEn) : v.variantNameEn,
          }))
        : detail.variants,
    };
  }

  /**
   * Real per-warehouse stock for a batch of CJ variant ids, via
   * GET /product/stock/queryByVid — no bulk form, so this is one request per
   * vid (same as CJ's other per-variant endpoints). Summed across every
   * warehouse row CJ returns for that vid.
   *
   * NOTE: `storageNum` as the quantity field name is CJ's documented v2
   * field for this endpoint but hasn't been confirmed against a live CJ
   * account from this environment — if CJ's response uses a different key,
   * `total` below will silently come out as 0 for every variant rather than
   * throwing, so cross-check a real response if imported stock looks wrong.
   */
  async getInventory(externalVariantIds: string[]): Promise<SupplierStock[]> {
    const stocks: SupplierStock[] = [];
    for (const vid of externalVariantIds) {
      try {
        const res = await this.request<CJVariantStock[]>(
          '/product/stock/queryByVid',
          'GET',
          undefined,
          { vid },
        );

        if (!res?.result || res.code !== 200) {
          logger.warn(
            `[CJDropshippingAdapter] getInventory: non-success response for vid ${vid} (code=${res?.code}, message=${res?.message}) — this variant falls back to the import placeholder stock.`,
          );
          continue;
        }

        const rows = Array.isArray(res.data) ? res.data : [];
        const total = rows.reduce((sum, row) => sum + (Number(row.storageNum) || 0), 0);

        if (rows.length > 0 && total === 0) {
          // Call succeeded and returned rows, but none had a numeric
          // `storageNum` — the real field name is probably different. Log
          // the raw row once so it's easy to spot-check against CJ's actual
          // response and fix the mapping in CJVariantStock/here.
          logger.warn(
            `[CJDropshippingAdapter] getInventory: vid ${vid} returned ${rows.length} row(s) with no usable storageNum — raw row: ${JSON.stringify(rows[0])}`,
          );
        }

        stocks.push({ externalId: vid, stock: total });
      } catch (e) {
        logger.error(`[CJDropshippingAdapter] getInventory error for vid ${vid}`, e);
      }
    }
    return stocks;
  }

  /** Maps the canonical payload to CJ's createOrderV2 shape. Shared by placeOrder and placeSandboxOrder. */
  private buildCreateOrderPayload(
    payload: PlaceOrderPayload,
    extra?: { isSandbox?: 0 | 1; logisticName?: string; fromCountryCode?: string },
  ): CJCreateOrderParams {
    return {
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
      logisticName: extra?.logisticName,
      fromCountryCode: extra?.fromCountryCode,
      products: payload.items.map((item) => ({
        vid: item.supplierVariantExternalId,
        quantity: item.quantity,
      })),
      ...(extra?.isSandbox ? { isSandbox: extra.isSandbox } : {}),
    };
  }

  async placeOrder(payload: PlaceOrderPayload): Promise<unknown> {
    const cjPayload = this.buildCreateOrderPayload(payload);
    const res = await this.request('/shopping/order/createOrderV2', 'POST', cjPayload);
    return res?.data;
  }

  async getOrderStatus(externalOrderId: string): Promise<unknown> {
    const res = await this.request('/shopping/order/getOrderDetail', 'GET', undefined, {
      orderId: externalOrderId,
    });
    return res?.data;
  }

  /**
   * Moves an order from CREATED(100) to UNPAID(200) — required before any
   * payment call, real (payBalance) or sandbox (simulatePay). Confirmed
   * live: calling simulatePay on a CREATED order fails with code 812,
   * "Current order status is CREATED(100), not UNPAID(200), cannot
   * simulate pay." — this step is NOT replaced by the sandbox flow, only
   * the actual charge (payBalance) is.
   */
  async confirmOrder(orderId: string): Promise<boolean> {
    const res = await this.request<boolean>('/shopping/order/confirmOrder', 'PATCH', { orderId });
    return Boolean(res?.data);
  }

  // --- Sandbox (testing) ---
  //
  // CJ's sandbox isn't a separate host — it's the same endpoints with
  // isSandbox=1 on order creation, plus test-only calls that stand in for
  // real payment and fulfillment. The full sequence, confirmed live:
  //   createOrderV2(isSandbox=1)
  //     -> [if logisticsMiss] getOrderLogisticsInfo -> updateLogistics
  //     -> confirmOrder                 (CREATED -> UNPAID — real call, not sandbox-only)
  //     -> simulatePay                  (UNPAID -> 300, stands in for payBalance)
  //     -> updateSandboxStatus* (advanceSandboxOrder)
  //     -> updateSandboxTrackNumber
  // See docs: https://developers.cjdropshipping.cn/en/api/start/sandbox.html

  /**
   * Creates a test order (no real balance charged, nothing ships).
   * `logisticName`/`fromCountryCode` are required by CJ's createOrderV2 for
   * any order, sandbox or real — this adapter has no account-level default
   * for either yet (placeOrder() shares that same gap), so callers must
   * supply them explicitly to get a valid test order.
   */
  async placeSandboxOrder(
    payload: PlaceOrderPayload,
    options: { logisticName: string; fromCountryCode: string },
  ): Promise<unknown> {
    const cjPayload = this.buildCreateOrderPayload(payload, { isSandbox: 1, ...options });
    const res = await this.request('/shopping/order/createOrderV2', 'POST', cjPayload);
    return res?.data;
  }

  /**
   * Moves an already-UNPAID sandbox order to 300 (paid) — stands in for
   * the real payBalance charge only. Requires confirmOrder() first: an
   * order fresh from createOrderV2 is CREATED, not UNPAID, and CJ rejects
   * simulatePay on a CREATED order (code 812).
   */
  async simulatePay(params: CJSimulatePayParams): Promise<boolean> {
    if (!params.orderId && !params.shipmentOrderId) {
      throw new Error('simulatePay requires orderId or shipmentOrderId');
    }
    const res = await this.request<boolean>('/shopping/sandbox/simulatePay', 'POST', params);
    return Boolean(res?.data);
  }

  /**
   * Steps a sandbox order forward exactly one stage. CJ enforces the ladder
   * strictly (300→400→500→600→700) — passing anything but the next status
   * is rejected, there's no skipping ahead or reverting.
   */
  async updateSandboxStatus(params: CJUpdateSandboxStatusParams): Promise<boolean> {
    const res = await this.request<boolean>('/shopping/sandbox/updateStatus', 'POST', params);
    return Boolean(res?.data);
  }

  /**
   * Attaches a fake tracking number to a sandbox order. Only accepted while
   * the order is paid and not yet closed (status 300-600) — CJ returns 819
   * otherwise.
   */
  async updateSandboxTrackNumber(params: CJUpdateSandboxTrackNumberParams): Promise<boolean> {
    const res = await this.request<boolean>('/shopping/sandbox/updateTrackNumber', 'POST', params);
    return Boolean(res?.data);
  }

  /**
   * Convenience for tests: replays updateSandboxStatus one hop at a time
   * from 300 up to `targetStatus`, since CJ won't accept a direct jump.
   * Call simulatePay() first — this assumes the order is already at 300.
   * Throws as soon as a hop is rejected rather than silently continuing —
   * CJ rejecting one transition (e.g. the order was never actually paid)
   * means every subsequent one in the ladder would fail too, so pressing
   * on and reporting success at the end would be misleading.
   */
  async advanceSandboxOrder(orderId: string, targetStatus: CJSandboxTargetStatus): Promise<void> {
    const targetIndex = SANDBOX_STATUS_LADDER.indexOf(targetStatus);
    for (let i = 0; i <= targetIndex; i++) {
      const step = SANDBOX_STATUS_LADDER[i];
      const ok = await this.updateSandboxStatus({ orderId, targetStatus: step });
      if (!ok) {
        throw new Error(
          `advanceSandboxOrder: CJ rejected the transition to ${step} for order ${orderId}`,
        );
      }
    }
  }

  // --- Logistics ---

  /**
   * Real shipping methods CJ will accept for an already-created order. Call
   * this when createOrderV2/createOrderV3 (real or sandbox) comes back with
   * `logisticsMiss: true` — the `logisticName` passed at creation wasn't a
   * real option for that order, so it exists but is unshippable (and, per
   * observed sandbox behavior, unpayable) until corrected via
   * updateLogistics with one of the options this returns.
   */
  async getOrderLogisticsInfo(orderCode: string): Promise<CJLogisticsOption[]> {
    const accessToken = await this.getAccessToken();
    if (!accessToken) return [];

    // Bypasses the shared request() helper deliberately: it parses via
    // res.json(), which would corrupt the big-integer `id` fields this
    // endpoint returns before we ever see them (see
    // parseJsonPreservingBigInts). Still goes through the same limiter for
    // rate-limit consistency with every other call; skips request()'s
    // retry-on-429 loop since this is a low-volume, one-off lookup, not a
    // high-traffic path.
    const url = `${CJ_BASE_URL}/shopping/order/getOrderLogisticsInfo?orderCode=${encodeURIComponent(orderCode)}`;
    const result = await this.limiter.schedule(async () => {
      const res = await fetch(url, {
        headers: { 'CJ-Access-Token': accessToken },
      });
      const text = await res.text();
      return parseJsonPreservingBigInts(text) as CJApiResponse<CJLogisticsOption[]>;
    });

    if (!result.result || result.code !== 200) {
      logger.error(
        '[CJDropshippingAdapter] API error for /shopping/order/getOrderLogisticsInfo:',
        result.message,
      );
      return [];
    }
    return Array.isArray(result.data) ? result.data : [];
  }

  /** Sets/corrects an order's shipping method — see getOrderLogisticsInfo. */
  async updateLogistics(params: CJUpdateLogisticsParams): Promise<boolean> {
    const res = await this.request<boolean>('/shopping/order/updateLogistics', 'POST', params);
    return Boolean(res?.data);
  }

  // --- Cancel & Refund ---
  //
  // CJ has no single "cancel this order" call that works at every stage.
  // Two separate mechanisms, depending on how far the order has progressed:
  //   - cancelOrder (deleteOrder): only while the order is CREATED/IN_CART,
  //     i.e. before confirmOrder has run. Rejects anything past that.
  //   - Disputes: the only path once an order is UNPAID or later. A dispute
  //     is a *request* CJ reviews and approves/rejects — not an instant
  //     refund. Flow: getDisputeProducts -> getDisputeConfirmInfo (caps the
  //     refundable amount + valid reasons) -> createDispute -> poll via
  //     getDisputeDetail/getDisputeList -> optionally cancelDispute to
  //     withdraw it before CJ rules.
  // See docs: https://developers.cjdropshipping.cn/en/api/api2/api/dispute.html

  /**
   * Deletes an order that hasn't progressed past CREATED/IN_CART yet — CJ
   * rejects this for anything already confirmOrder'd, which in this
   * adapter's own placeOrder/confirmOrder flow happens almost immediately
   * after creation. Use the dispute methods below for anything past that
   * point.
   */
  async cancelOrder(orderId: string): Promise<boolean> {
    const res = await this.request<boolean>(
      `/shopping/order/deleteOrder?orderId=${encodeURIComponent(orderId)}`,
      'DELETE',
    );
    return Boolean(res?.result);
  }

  /** Line items on this order CJ will accept a dispute against. Call first — not every item is always eligible. */
  async getDisputeProducts(orderId: string): Promise<CJDisputeProduct[]> {
    const res = await this.request<CJDisputeProduct[]>('/disputes/disputeProducts', 'GET', undefined, {
      orderId,
    });
    return Array.isArray(res?.data) ? res.data : [];
  }

  /**
   * Returns the max refundable amount and valid dispute reasons for the
   * chosen line items — call this before createDispute so the amount you
   * request isn't rejected outright for exceeding what was actually paid.
   */
  async getDisputeConfirmInfo(
    orderId: string,
    productInfoList: { lineItemId: string; quantity: number; price: number }[],
  ): Promise<CJDisputeConfirmInfo | null> {
    const res = await this.request<CJDisputeConfirmInfo>('/disputes/disputeConfirmInfo', 'POST', {
      orderId,
      productInfoList,
    });
    return res?.data ?? null;
  }

  /** Files the actual refund/reissue request. Doesn't move any money itself — CJ reviews and decides. */
  async createDispute(params: CJCreateDisputeParams): Promise<boolean> {
    const res = await this.request<boolean>('/disputes/create', 'POST', params);
    return Boolean(res?.data);
  }

  /** Withdraws a dispute before CJ has ruled on it. */
  async cancelDispute(params: CJCancelDisputeParams): Promise<boolean> {
    const res = await this.request<boolean>('/disputes/cancel', 'POST', params);
    return Boolean(res?.data);
  }

  /** Paginated dispute list, optionally filtered by order. */
  async getDisputeList(
    params: CJDisputeListParams,
  ): Promise<{ items: CJDispute[]; total: number }> {
    const res = await this.request<{ list: CJDispute[]; total: number }>(
      '/disputes/getDisputeList',
      'GET',
      undefined,
      params as Record<string, string | number | undefined>,
    );
    return { items: res?.data?.list ?? [], total: res?.data?.total ?? 0 };
  }

  /** Full detail for one dispute, including the resolved refund breakdown once CJ has ruled. */
  async getDisputeDetail(disputeId: string): Promise<CJDispute | null> {
    const res = await this.request<CJDispute>('/disputes/getDisputeDetail', 'GET', undefined, {
      disputeId,
    });
    return res?.data ?? null;
  }

  /**
   * SupplierAdapter.requestRefund implementation — orchestrates the full
   * dispute chain (getDisputeProducts -> getDisputeConfirmInfo ->
   * createDispute) behind the generic, supplier-agnostic signature callers
   * use. Always requests a refund of every CJ-eligible line item on the
   * order for its full paid quantity — this adapter has no way to accept a
   * partial-item/partial-quantity refund request from the caller yet, since
   * the generic interface only takes an orderId + reason.
   *
   * Picks the FIRST dispute reason CJ returns from getDisputeConfirmInfo —
   * there's no mapping yet from an app-level refund reason to CJ's specific
   * disputeReasonId catalog. Fine as a default for now (CJ's review is
   * manual either way), but revisit if wrong-reason disputes turn out to
   * get rejected more often than a correctly-reasoned one would.
   *
   * Confirmed live (sandbox): CJ rejects disputes on sandbox orders outright
   * ("Order cannot be disputed", code 9060) via getDisputeProducts returning
   * an empty list — which this method treats as `requested: false`, not an
   * error. Real (non-sandbox) orders are unverified — the reason-picking and
   * createDispute steps have never actually run against a live order.
   */
  async requestRefund(params: {
    orderId: string;
    reason: string;
  }): Promise<{ requested: boolean; externalRefundId?: string; raw?: unknown }> {
    const eligible = await this.getDisputeProducts(params.orderId);
    if (eligible.length === 0) {
      return { requested: false, raw: { reason: 'No dispute-eligible line items on this order' } };
    }

    const productInfoList = eligible.map((p) => ({
      lineItemId: p.lineItemId,
      quantity: p.quantity,
      price: p.price,
    }));

    const confirmInfo = await this.getDisputeConfirmInfo(params.orderId, productInfoList);
    const reasonId = confirmInfo?.disputeReasons?.[0]?.id;
    if (!reasonId) {
      return { requested: false, raw: confirmInfo };
    }

    const created = await this.createDispute({
      orderId: params.orderId,
      businessDisputeId: `REFUND-${params.orderId}-${Date.now()}`,
      disputeReasonId: reasonId,
      expectType: 1, // refund
      refundType: 1, // balance
      messageText: params.reason.slice(0, 500),
      productInfoList,
    });
    if (!created) {
      return { requested: false, raw: confirmInfo };
    }

    const list = await this.getDisputeList({ orderId: params.orderId });
    const dispute = list.items[0];
    return { requested: true, externalRefundId: dispute?.disputeId, raw: dispute };
  }
}
