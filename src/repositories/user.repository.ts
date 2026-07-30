import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

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

  static async findAll(page = 1, limit = 10) {
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      prisma.authUser.findMany({
        where: { isDeleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.authUser.count({ where: { isDeleted: false } }),
    ]);

    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }
}
