import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class CustomerRepository {
  static async findById(id: string) {
    return prisma.customer.findUnique({
      where: { id },
      include: {
        addresses: true,
        user: true,
      },
    });
  }

  static async findByUserId(userId: string) {
    return prisma.customer.findUnique({
      where: { userId },
      include: {
        addresses: true,
      },
    });
  }

  static async findByEmail(email: string) {
    return prisma.customer.findUnique({
      where: { email },
      include: {
        addresses: true,
      },
    });
  }

  static async create(data: Prisma.CustomerCreateInput) {
    return prisma.customer.create({
      data,
    });
  }

  static async update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({
      where: { id },
      data,
    });
  }

  static async addShippingAddress(customerId: string, addressData: Omit<Prisma.ShippingAddressCreateInput, 'customer'>) {
    return prisma.shippingAddress.create({
      data: {
        ...addressData,
        customer: { connect: { id: customerId } },
      },
    });
  }
}
