export interface NormalizedProductSearchItem {
  id: string; // The supplier's external ID
  supplierId: string; // The ID of the supplier (e.g. 'cj-dropshipping', 'aliexpress')
  title: string;
  price: number;
  imageUrl?: string;
  originalUrl?: string; // Link to the product on the supplier's platform
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rawData?: any; // The original un-normalized data from the supplier
}
