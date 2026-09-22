export interface CJApiResponse<T = unknown> {
  code: number;
  result: boolean;
  message: string;
  data: T;
  requestId: string;
}

export interface CJProduct {
  pid: string;
  productNameEn: string;
  productNameCn?: string;
  productSku: string;
  productImage: string;
  /** Full image gallery for the product — `productImage`/`bigImage` is just the first entry. */
  productImageSet?: string[];
  /** e.g. "260.00-300.00" (grams) — a range across variants, not a plain number. */
  productWeight: string;
  productType: string;
  productUnit: string;
  sellPrice: number;
  categoryId: string;
  categoryName: string;
  sourceFrom: number;
  remark?: string;
  createTime: string;
}

export interface CJProductListResponse {
  list: CJProduct[];
  pageNum: number;
  pageSize: number;
  total: number;
  totalPages?: number;
}

/**
 * Real response shape of GET /product/listV2, confirmed by calling it
 * directly — distinct field names from CJProduct, which reflects
 * /product/query's shape instead.
 */
export interface CJProductListV2Item {
  id: string;
  nameEn: string;
  sku: string;
  bigImage: string;
  sellPrice: number;
  /**
   * Set instead of the product fields above when CJ wraps the page in a
   * single result object rather than returning products directly —
   * depends on the requested page `size`. Callers must unwrap this when set.
   */
  productList?: CJProductListV2Item[];
  [key: string]: unknown;
}

export interface CJProductListV2Data {
  pageSize: number;
  pageNumber: number;
  totalRecords: number;
  totalPages: number;
  content: CJProductListV2Item[];
}

export interface CJTokenData {
  accessToken: string;
  accessTokenExpiryDate: string;
  refreshToken: string;
  refreshTokenExpiryDate: string;
  createDate: string;
}

export interface CJVariant {
  vid: string;
  pid: string;
  variantNameEn: string;
  variantSku: string;
  variantImage?: string;
  variantStandard?: string;
  variantUnit?: string;
  variantProperty?: string;
  variantKey?: string;
  variantLength?: number;
  variantWidth?: number;
  variantHeight?: number;
  variantVolume?: number;
  variantWeight?: number;
  variantSellPrice: number;
}

export interface CJProductDetail extends CJProduct {
  entryCode?: string;
  entryName?: string;
  materialKey?: string;
  materialName?: string;
  packingWeight?: number;
  packingKey?: string;
  packingName?: string;
  productKey?: string;
  description?: string;
  variants?: CJVariant[];
}

export interface CJOrderItem {
  vid: string;
  quantity: number;
}

/**
 * Params for POST /logistic/freightCalculate — quotes real shipping methods
 * and prices for a set of variants + destination *before* any order exists
 * (unlike getOrderLogisticsInfo, which only works on an already-created
 * order). `startCountryCode` is CJ's shipping origin (same default as
 * placeOrder's DEFAULT_FROM_COUNTRY_CODE, 'CN', unless the item ships from
 * a different warehouse); `zip` is optional but improves accuracy for
 * countries where duties/remote-area surcharges depend on it.
 */
export interface CJFreightCalculateParams {
  startCountryCode: string;
  endCountryCode: string;
  zip?: string;
  products: { vid: string; quantity: number }[];
}

/**
 * Row shape of POST /logistic/freightCalculate's response — one shipping
 * method CJ can offer for the given products+destination, with its price.
 * Not ground-truthed against a live account (unlike CJLogisticsOption);
 * field names follow CJ's published docs.
 */
export interface CJFreightOption {
  logisticName: string;
  logisticPrice: number;
  logisticPriceCn?: number;
  logisticAging: string;
  taxesFee?: number;
  clearanceOperationFee?: number;
  totalPostageFee?: number;
  [key: string]: unknown;
}

export interface CJCreateOrderParams {
  orderNumber: string;
  shippingCountryCode: string;
  shippingCountry: string;
  shippingProvince: string;
  shippingCity: string;
  shippingAddress: string;
  shippingAddress2?: string;
  shippingCustomerName: string;
  shippingZip: string;
  shippingPhone: string;
  shippingEmail?: string;
  remark?: string;
  logisticName?: string;
  fromCountryCode?: string;
  products: CJOrderItem[];
  /** 1 = create as a sandbox/test order (no real balance, no real shipment). Omitted for real orders. */
  isSandbox?: 0 | 1;
}

/**
 * CJ's sandbox status ladder. Orders move strictly 300 (paid) → 400 → 500 →
 * 600 → 700 — updateSandboxStatus only ever accepts the *next* value in this
 * list, never a skip or a revert.
 */
export type CJSandboxTargetStatus = 400 | 500 | 600 | 700;

export interface CJSimulatePayParams {
  /** CJ order ID of the sandbox order. Provide this or shipmentOrderId. */
  orderId?: string;
  /** Parent order ID, for paying a batch of sandbox orders at once. */
  shipmentOrderId?: string;
}

/**
 * Params for the real (non-sandbox) POST /shopping/pay/payBalance —
 * deducts the order's cost from your actual CJ account balance. Same shape
 * as CJSimulatePayParams by design: triangulated from CJ's docs/search
 * results (not ground-truthed against a live account the way
 * CJSimulatePayParams was), and simulatePay's sandbox stand-in takes the
 * same two fields, so this mirrors it. See
 * CJDropshippingAdapter.payBalance's doc comment before using this for real.
 */
export interface CJPayBalanceParams {
  /** CJ order ID from createOrderV2/confirmOrder. Provide this or shipmentOrderId. */
  orderId?: string;
  /** Parent order ID, for paying a batch of real orders at once (see payBalanceV2, not implemented here). */
  shipmentOrderId?: string;
}

/** Result of CJDropshippingAdapter.placeOrder — a resolved id, not the raw CJ payload. */
export interface CJPlaceOrderResult {
  /** Extracted via the same orderId/orderNum/id fallback scripts/test-cj-sandbox.ts uses — CJ's real field name is unconfirmed. */
  orderId: string;
  /** True if CJ flagged the initial logisticName as invalid (logisticsMiss) and placeOrder() corrected it automatically. */
  logisticsAutoCorrected: boolean;
  /** Full createOrderV2 response, for callers that need fields this type doesn't surface. */
  raw: Record<string, unknown>;
}

export interface CJUpdateSandboxStatusParams {
  orderId: string;
  targetStatus: CJSandboxTargetStatus;
}

export interface CJUpdateSandboxTrackNumberParams {
  orderId: string;
  /** Max 64 characters. Only accepted while the order is paid and not yet closed (status 300-600). */
  trackNumber: string;
}

/**
 * Row shape of GET /shopping/order/getOrderLogisticsInfo — one shipping
 * method CJ will actually accept for a given order. Call this whenever
 * createOrderV2/createOrderV3 comes back with `logisticsMiss: true` — it
 * means the `logisticName` passed at creation wasn't a real option, so the
 * order was created but left unshippable (and therefore unpayable) until
 * corrected via updateLogistics.
 *
 * Confirmed against a live account via scripts/test-cj-sandbox.ts — note
 * the field is `logisticsName` (with an s), unlike CJCreateOrderParams'
 * `logisticName` (without). `id` here is the logistics *option's* id, not
 * the order's — that's what updateLogistics' `id` param actually wants.
 */
export interface CJLogisticsOption {
  /**
   * String, not number: CJ's real id is a 19-digit integer, past
   * Number.MAX_SAFE_INTEGER — plain JSON parsing rounds it, and every
   * option in the list ends up with the same corrupted value (confirmed
   * live). CJDropshippingAdapter.getOrderLogisticsInfo parses this
   * endpoint's response specially to keep it intact as a string.
   */
  id: string;
  orderCode: string;
  logisticsName: string;
  postage: number;
  arrivalTime: string;
  hasStock: boolean;
  [key: string]: unknown;
}

export interface CJUpdateLogisticsParams {
  /** The chosen CJLogisticsOption's own `id` (string — see CJLogisticsOption.id) — not the order's id/code. */
  id: string;
  orderCode: string;
  logisticName: string;
}

export interface CJOrder {
  orderId: string;
  orderNum: string;
  orderStatus: string;
  shippingCountryCode: string;
  shippingCountry: string;
  shippingProvince: string;
  shippingCity: string;
  shippingAddress: string;
  shippingCustomerName: string;
  shippingZip: string;
  shippingPhone: string;
  createDate: string;
  paymentDate?: string;
  trackNumber?: string;
  logisticName?: string;
}

/**
 * Row shape of GET /product/stock/queryByVid — one entry per warehouse that
 * stocks the variant. `storageNum` is CJ's documented field name for
 * available quantity at that warehouse; kept loose (`[key: string]:
 * unknown`) since this hasn't been confirmed against a live CJ account —
 * see CJDropshippingAdapter.getInventory.
 */
export interface CJVariantStock {
  vid: string;
  storageNum?: number;
  countryCode?: string;
  areaEn?: string;
  [key: string]: unknown;
}

// --- Disputes (post-payment refund/reissue requests) ---
// Docs: https://developers.cjdropshipping.cn/en/api/api2/api/dispute.html
// Unconfirmed against a live account — field names follow the docs but
// haven't been ground-truthed the way e.g. CJLogisticsOption's `id` was.

/** One line item CJ considers eligible to dispute, from GET /disputes/disputeProducts. */
export interface CJDisputeProduct {
  lineItemId: string;
  quantity: number;
  price: number;
  [key: string]: unknown;
}

export interface CJDisputeProductLine {
  lineItemId: string;
  quantity: number;
  price: number;
}

/** Response of POST /disputes/disputeConfirmInfo — the ceiling for what createDispute can request. */
export interface CJDisputeConfirmInfo {
  maxRefundAmount?: number;
  disputeReasons?: { id: number; name: string }[];
  [key: string]: unknown;
}

/** 1 = refund, 2 = reissue (a replacement shipment). */
export type CJDisputeExpectType = 1 | 2;

/** 1 = balance refund (credited to your CJ account), 2 = platform refund (original payment method). */
export type CJDisputeRefundType = 1 | 2;

export interface CJCreateDisputeParams {
  orderId: string;
  /** Your own idempotency key for this dispute — CJ's docs cap it at 100 chars. */
  businessDisputeId: string;
  disputeReasonId: number;
  expectType: CJDisputeExpectType;
  refundType: CJDisputeRefundType;
  /** Max 500 chars. */
  messageText: string;
  imageUrl?: string[];
  videoUrl?: string[];
  productInfoList: CJDisputeProductLine[];
}

export interface CJCancelDisputeParams {
  orderId: string;
  disputeId: string;
}

export interface CJDisputeListParams {
  orderId?: string;
  disputeId?: number;
  orderNumber?: string;
  pageNum?: number;
  pageSize?: number;
}

export interface CJDispute {
  disputeId: string;
  orderId: string;
  status: string;
  disputeReasonId?: number;
  refundAmount?: number;
  [key: string]: unknown;
}
