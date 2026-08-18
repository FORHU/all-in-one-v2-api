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

export interface CJUpdateSandboxStatusParams {
  orderId: string;
  targetStatus: CJSandboxTargetStatus;
}

export interface CJUpdateSandboxTrackNumberParams {
  orderId: string;
  /** Max 64 characters. Only accepted while the order is paid and not yet closed (status 300-600). */
  trackNumber: string;
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
