// ---------------------------------------------------------------------------
// Printful API – Type definitions
// Base URL: https://api.printful.com
// Authentication: Bearer token via Authorization header
// All list endpoints return { code, result, extra, error }
// ---------------------------------------------------------------------------

export interface PrintfulApiResponse<T = unknown> {
  code: number;
  result: T;
  extra?: unknown;
  error?: {
    reason: string;
    message: string;
  };
}

export interface PrintfulPaginatedResponse<T = unknown> {
  code: number;
  result: T[];
  extra?: {
    pagination?: {
      total: number;
      limit: number;
      offset: number;
    };
  };
}

// --- Catalog ---

export interface PrintfulCatalogProduct {
  id: number;
  main_category_id: number;
  type: string;
  type_name: string;
  title: string;
  brand?: string;
  model?: string;
  image: string;
  variant_count: number;
  currency: string;
  is_discontinued: boolean;
  description: string;
  techniques?: PrintfulTechnique[];
  files?: PrintfulProductFile[];
  options?: PrintfulProductOption[];
}

export interface PrintfulTechnique {
  key: string;
  display_name: string;
  is_default: boolean;
}

export interface PrintfulProductFile {
  id: string;
  type: string;
  title: string;
  additional_price?: string | null;
}

export interface PrintfulProductOption {
  id: string;
  title: string;
  type: string;
  values: Record<string, string>;
  additional_price_breakdown?: Record<string, string>;
}

export interface PrintfulCatalogVariant {
  id: number;
  product_id: number;
  name: string;
  size: string;
  color: string;
  color_code?: string;
  color_code2?: string | null;
  image: string;
  price: string;
  in_stock: boolean;
  availability_regions?: Record<string, string>;
  availability_status?: Array<{ region: string; status: string }>;
}

export interface PrintfulCatalogProductDetail {
  product: PrintfulCatalogProduct;
  variants: PrintfulCatalogVariant[];
}

export interface PrintfulSizeGuide {
  product_id: number;
  available_sizes: string[];
  size_tables: PrintfulSizeTable[];
}

export interface PrintfulSizeTable {
  type: string;
  unit: string;
  description?: string;
  image_url?: string;
  image_description?: string;
  measurements: Array<{
    type_label: string;
    values: Array<{ size: string; value?: string; min_value?: string; max_value?: string }>;
  }>;
}

export interface PrintfulCategory {
  id: number;
  parent_id: number;
  image_url: string;
  catalog_position: number;
  size: number;
  title: string;
}

// --- Orders ---

export interface PrintfulRecipient {
  name: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state_code?: string;
  state_name?: string;
  country_code: string;
  country_name?: string;
  zip: string;
  phone?: string;
  email?: string;
  tax_number?: string;
}

export interface PrintfulFileOption {
  id: string;
  value: string | boolean;
}

export interface PrintfulFilePosition {
  area_width: number;
  area_height: number;
  width: number;
  height: number;
  top: number;
  left: number;
  limit_to_print_area?: boolean;
}

export interface PrintfulOrderFile {
  type: string;
  url?: string;
  id?: number;
  options?: PrintfulFileOption[];
  filename?: string;
  visible?: boolean;
  position?: PrintfulFilePosition;
}

export interface PrintfulOrderItemProduct {
  variant_id: number;
  product_id: number;
  image?: string;
  name?: string;
}

export interface PrintfulOrderItemOption {
  id: string;
  value: string;
}

export interface PrintfulOrderItem {
  id?: number;
  external_id?: string;
  variant_id?: number;
  sync_variant_id?: number | string;
  external_variant_id?: string;
  warehouse_product_variant_id?: number;
  product_template_id?: number;
  external_product_id?: string;
  quantity: number;
  price?: string;
  retail_price?: string;
  name?: string;
  product?: PrintfulOrderItemProduct;
  files?: PrintfulOrderFile[];
  options?: PrintfulOrderItemOption[];
  sku?: string | null;
  discontinued?: boolean;
  out_of_stock?: boolean;
}

export interface PrintfulRetailCosts {
  currency: string;
  subtotal?: string;
  discount?: string;
  shipping?: string;
  tax?: string;
  vat?: string;
  total?: string;
}

export interface PrintfulGift {
  subject: string;
  message: string;
}

export interface PrintfulPackingSlip {
  email?: string;
  phone?: string;
  message?: string;
  logo_url?: string;
  store_name?: string;
  custom_order_id?: string;
}

export interface PrintfulCreateOrderParams {
  external_id?: number | string;
  shipping: string;
  recipient: PrintfulRecipient;
  items: PrintfulOrderItem[];
  retail_costs?: PrintfulRetailCosts;
  gift?: PrintfulGift;
  packing_slip?: PrintfulPackingSlip;
}

export interface PrintfulOrder {
  id: number;
  external_id?: string;
  store: number;
  status: string;
  shipping: string;
  shipping_service_name?: string;
  created: number;
  updated: number;
  recipient: PrintfulRecipient;
  items: PrintfulOrderItem[];
  costs?: PrintfulRetailCosts;
  retail_costs?: PrintfulRetailCosts;
  gift?: PrintfulGift;
  packing_slip?: PrintfulPackingSlip;
  shipments?: PrintfulShipment[];
}

export interface PrintfulShipment {
  id: number;
  carrier: string;
  service: string;
  tracking_number?: string;
  tracking_url?: string;
  created: number;
  ship_date?: string;
  shipped_at?: number;
  reshipment?: boolean;
  items?: Array<{ item_id: number; quantity: number }>;
}

// --- Shipping ---

export interface PrintfulShippingRateItem {
  variant_id?: string;
  external_variant_id?: string;
  warehouse_product_variant_id?: string;
  quantity: number;
  value?: string;
}

export interface PrintfulShippingRateRecipient {
  address1: string;
  city: string;
  country_code: string;
  state_code?: string;
  zip?: string;
  phone?: string;
}

export interface PrintfulShippingRateParams {
  recipient: PrintfulShippingRateRecipient;
  items: PrintfulShippingRateItem[];
  currency?: string;
  locale?: string;
}

export interface PrintfulShippingRate {
  id: string;
  name: string;
  rate: string;
  currency: string;
  minDeliveryDays?: number;
  maxDeliveryDays?: number;
  minDeliveryDate?: string;
  maxDeliveryDate?: string;
}

// --- Stores ---

export interface PrintfulStore {
  id: number;
  name: string;
  type: string;
  website?: string;
  currency: string;
  payment_card?: string;
  return_address?: PrintfulRecipient;
  billing_address?: PrintfulRecipient;
  packing_branding?: boolean;
  logo_url?: string;
  external_id?: string;
}

// --- Files ---

export interface PrintfulFile {
  id: number;
  type: string;
  hash: string;
  url?: string;
  filename: string;
  mime_type: string;
  size: number;
  width?: number;
  height?: number;
  dpi?: number;
  status: string;
  created: number;
  thumbnail_url?: string;
  preview_url?: string;
  visible?: boolean;
  is_temporary?: boolean;
}

// --- Webhooks ---

export interface PrintfulWebhookConfig {
  url: string;
  types: string[];
  params?: Record<string, unknown>;
}

// --- Product Templates ---

export interface PrintfulProductTemplate {
  id: number;
  main_category_id?: number;
  type?: string;
  type_name?: string;
  brand?: string;
  model?: string;
  image?: string;
  variant_count?: number;
  currency?: string;
  files?: PrintfulProductFile[];
  options?: PrintfulProductOption[];
  is_discontinued?: boolean;
  avg_fulfillment_time?: number;
  techniques?: PrintfulTechnique[];
  description?: string;
}

// --- OAuth Scopes ---
export interface PrintfulOAuthScope {
  name: string;
  description?: string;
}
