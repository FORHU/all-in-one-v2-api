import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class CategoryRepository {
  static async findById(id: string) {
    return prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
      },
    });
  }

  static async findBySlug(slug: string) {
    return prisma.category.findUnique({
      where: { slug },
      include: {
        parent: true,
        children: true,
        products: {
          take: 20,
          include: {
            images: true,
            variants: true,
          },
        },
      },
    });
  }

  static async findAllRoot() {
    return prisma.category.findMany({
      where: { parentId: null },
      include: {
        children: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  static async create(data: Prisma.CategoryCreateInput) {
    return prisma.category.create({
      data,
    });
  }

  static async update(id: string, data: Prisma.CategoryUpdateInput) {
    return prisma.category.update({
      where: { id },
      data,
    });
  }

  static async delete(id: string) {
    return prisma.category.delete({
      where: { id },
    });
  }
}
