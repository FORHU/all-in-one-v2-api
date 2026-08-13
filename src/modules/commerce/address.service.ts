import AddressRepository, { ShippingAddressInput } from './address.repository';

export default class AddressService {
  static async getLatestAddress(customerId: string) {
    return AddressRepository.findLatestForCustomer(customerId);
  }

  static async saveAddress(customerId: string, data: ShippingAddressInput) {
    return AddressRepository.create(customerId, data);
  }
}
