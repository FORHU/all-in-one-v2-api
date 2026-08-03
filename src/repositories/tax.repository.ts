import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class TaxRepository {
  static async createTaxClass(tenantId: string, data: Omit<Prisma.TaxClassCreateInput, 'tenant'>) {
    return prisma.taxClass.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  static async findTaxClasses(tenantId: string) {
    return prisma.taxClass.findMany({
      where: { tenantId },
      include: { rates: true },
    });
  }
}
