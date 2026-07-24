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
  productWeight: number;
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

export interface CJInventory {
  vid: string;
  variantSku: string;
  quantity: number;
  warehouseId: string;
  warehouseName: string;
}
