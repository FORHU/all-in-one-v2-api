import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export default class NotificationRepository {
  static async createNotification(
    tenantId: string,
    data: Omit<Prisma.NotificationCreateInput, 'tenant'>,
  ) {
    return prisma.notification.create({
      data: {
        ...data,
        tenant: { connect: { id: tenantId } },
      },
    });
  }

  static async findByUserId(tenantId: string, userId: string) {
    return prisma.notification.findMany({
      where: { tenantId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async findById(id: string) {
    return prisma.notification.findUnique({ where: { id } });
  }

  static async markAsRead(id: string) {
    return prisma.notification.update({
      where: { id },
      data: { isRead: true, readAt: new Date() },
    });
  }
}
