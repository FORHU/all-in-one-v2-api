import { prisma } from '../../utils/prisma';

export interface ShippingAddressInput {
  fullName: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export default class AddressRepository {
  /** Most recently saved address for this customer — "use the latest address" on checkout. */
  static async findLatestForCustomer(customerId: string) {
    return prisma.commerceShippingAddress.findFirst({
      where: { customerId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async create(customerId: string, data: ShippingAddressInput) {
    return prisma.commerceShippingAddress.create({
      data: {
        ...data,
        customer: { connect: { id: customerId } },
      },
    });
  }
}
