import { Prisma, UserRole } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { paginate } from '../helpers/pagination.helper';

export class UserRepository {
  static async findById(id: string) {
    return prisma.authUser.findFirst({
      where: { id, isDeleted: false },
      include: { avatar: true },
    });
  }

  static async findByEmail(email: string) {
    return prisma.authUser.findFirst({
      where: { email, isDeleted: false },
    });
  }

  static async findByUsername(username: string) {
    return prisma.authUser.findFirst({
      where: { username, isDeleted: false },
    });
  }

  static async create(data: Prisma.AuthUserCreateInput) {
    return prisma.authUser.create({
      data,
    });
  }

  static async update(id: string, data: Prisma.AuthUserUpdateInput) {
    return prisma.authUser.update({
      where: { id },
      data,
    });
  }

  static async softDelete(id: string) {
    return prisma.authUser.update({
      where: { id },
      data: { isDeleted: true },
    });
  }

  // Fields an admin can reasonably sort the user list by. Whitelisted so an
  // arbitrary `?sortBy=` query param can't be handed straight to Prisma's
  // orderBy (unknown fields throw a Prisma validation error).
  private static readonly SORTABLE_FIELDS = new Set([
    'createdAt',
    'updatedAt',
    'email',
    'username',
    'name',
    'lastLoginAt',
  ]);

  static async findAll(
    page = 1,
    limit = 10,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    role?: string,
    isActive?: boolean,
  ) {
    const validRole =
      role && (Object.values(UserRole) as string[]).includes(role)
        ? (role as UserRole)
        : undefined;
    const where: Prisma.AuthUserWhereInput = {
      isDeleted: false,
      ...(validRole && { role: validRole }),
      ...(isActive !== undefined && { isActive }),
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

    return paginate(prisma.authUser, {
      where,
      orderBy,
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    });
  }
}
