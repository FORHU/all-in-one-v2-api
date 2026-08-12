import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../../utils/prisma';
import { buildPage } from '../../helpers/pagination.helper';

export default class CustomerRepository {
  // Fields the admin customers list can sort by. Whitelisted for the same
  // reason as UserRepository.SORTABLE_FIELDS — an arbitrary `?sortBy=` can't
  // be handed straight to Prisma's orderBy.
  private static readonly SORTABLE_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'email',
    'username',
    'name',
    'lastLoginAt',
  ]);

  /**
   * Paginated list for the admin customers page, scoped to one tenant.
   * AuthUser/CommerceCustomer have no tenantId of their own — one identity
   * can shop across verticals — so tenant membership is derived: an AuthUser
   * counts as this tenant's customer only if their linked CommerceCustomer
   * has an order or cart in it. That also means `customer` is never null on
   * the results, unlike the old unscoped query.
   */
  static async findAll(
    tenantId: string,
    page = 1,
    limit = 10,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    isActive?: boolean,
  ) {
    const where: Prisma.AuthUserWhereInput = {
      isDeleted: false,
      role: UserRole.USER,
      ...(isActive !== undefined && { isActive }),
      customer: {
        is: {
          OR: [{ orders: { some: { tenantId } } }, { carts: { some: { tenantId } } }],
        },
      },
      ...(search && {
        OR: [
          { email: { contains: search, mode: 'insensitive' } },
          { username: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const orderBy: Prisma.AuthUserOrderByWithRelationInput =
      sortBy && this.SORTABLE_FIELDS.has(sortBy)
        ? { [sortBy]: sortOrder ?? 'asc' }
        : { createdAt: 'desc' };

    // Called directly against prisma.authUser (not through the paginate()
    // helper) because its minimal PaginatableDelegate interface can't
    // represent Prisma's include-conditional return type — going through it
    // would type `items` as plain AuthUser, dropping `customer`.
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.authUser.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          customer: {
            include: {
              // Order count is tenant-scoped too — a customer who's shopped
              // in two verticals shouldn't have the other tenant's orders
              // padding this number.
              _count: { select: { orders: { where: { tenantId } } } },
            },
          },
        },
      }),
      prisma.authUser.count({ where }),
    ]);

    return buildPage(items, total, { page, limit, sortBy, sortOrder, search });
  }

  static async findById(id: string) {
    return prisma.commerceCustomer.findUnique({
      where: { id },
      include: {
        addresses: true,
        user: true,
      },
    });
  }

  static async findByUserId(userId: string) {
    return prisma.commerceCustomer.findUnique({
      where: { userId },
      include: {
        addresses: true,
      },
    });
  }

  static async findByEmail(email: string) {
    return prisma.commerceCustomer.findUnique({
      where: { email },
      include: {
        addresses: true,
      },
    });
  }

  static async create(data: Prisma.CommerceCustomerCreateInput) {
    return prisma.commerceCustomer.create({
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
    const existing = await prisma.commerceCustomer.findUnique({ where: { userId: user.id } });
    if (existing) return existing;

    // The user may have ordered as a guest under this email before signing up;
    // claim that record rather than colliding with the unique constraint.
    const byEmail = await prisma.commerceCustomer.findUnique({ where: { email: user.email } });
    if (byEmail) {
      return prisma.commerceCustomer.update({
        where: { id: byEmail.id },
        data: { userId: user.id },
      });
    }

    return prisma.commerceCustomer.create({
      data: {
        userId: user.id,
        email: user.email,
        firstName: user.name ?? undefined,
      },
    });
  }

  static async update(id: string, data: Prisma.CommerceCustomerUpdateInput) {
    return prisma.commerceCustomer.update({
      where: { id },
      data,
    });
  }

  static async findAddressById(id: string) {
    return prisma.commerceShippingAddress.findUnique({ where: { id } });
  }

  static async addShippingAddress(
    customerId: string,
    addressData: Omit<Prisma.CommerceShippingAddressCreateInput, 'customer'>,
  ) {
    return prisma.commerceShippingAddress.create({
      data: {
        ...addressData,
        customer: { connect: { id: customerId } },
      },
    });
  }
}
