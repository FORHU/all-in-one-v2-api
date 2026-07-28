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

  /**
   * Returns the Customer record for a signed-in User, creating it on first use.
   *
   * `req.user.id` is a User id, but carts and orders are keyed by Customer id —
   * everything that checks ownership has to go through here first.
   */
  static async findOrCreateForUser(user: { id: string; email: string; name?: string | null }) {
    const existing = await prisma.customer.findUnique({ where: { userId: user.id } });
    if (existing) return existing;

    // The user may have ordered as a guest under this email before signing up;
    // claim that record rather than colliding with the unique constraint.
    const byEmail = await prisma.customer.findUnique({ where: { email: user.email } });
    if (byEmail) {
      return prisma.customer.update({
        where: { id: byEmail.id },
        data: { userId: user.id },
      });
    }

    return prisma.customer.create({
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.name ?? undefined,
      },
    });
  }

  static async update(id: string, data: Prisma.CustomerUpdateInput) {
    return prisma.customer.update({
      where: { id },
      data,
    });
  }

  static async findAddressById(id: string) {
    return prisma.shippingAddress.findUnique({ where: { id } });
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
