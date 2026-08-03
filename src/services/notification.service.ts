import NotificationRepository from '../repositories/notification.repository';
import { Prisma } from '@prisma/client';
import { requireTenantId } from '../utils/async-context';

export default class NotificationService {
  static async createNotification(data: Omit<Prisma.NotificationCreateInput, 'tenant'>) {
    return NotificationRepository.createNotification(requireTenantId(), data);
  }

  static async getMyNotifications(userId: string) {
    return NotificationRepository.findByUserId(requireTenantId(), userId);
  }

  static async markAsRead(notificationId: string) {
    return NotificationRepository.markAsRead(notificationId);
  }
}
