/**
 * "Complete" here means checkout-ready — i.e. enough for a supplier order
 * (CJ Dropshipping requires all of these). Note `state` is required for
 * completeness even though the DB column stays optional.
 */
export const REQUIRED_SHIPPING_FIELDS = [
  'countryCode',
  'country',
  'state',
  'city',
  'addressLine1',
  'firstName',
  'lastName',
  'postalCode',
  'phone',
] as const;

export type ShippingCompletenessInput = {
  countryCode?: string | null;
  country?: string | null;
  state?: string | null;
  city?: string | null;
  addressLine1?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  postalCode?: string | null;
  phone?: string | null;
};

export function isShippingAddressComplete(
  address: ShippingCompletenessInput | null | undefined,
): boolean {
  if (!address) return false;
  return REQUIRED_SHIPPING_FIELDS.every((field) => !!address[field]?.trim());
}
