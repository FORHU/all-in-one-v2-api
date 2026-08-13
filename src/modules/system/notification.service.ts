import NotificationRepository from './notification.repository';
import { Prisma } from '@prisma/client';
import { requireTenantId } from '../../utils/async-context';
import { throwResponse } from '../../utils/throw-response';

export default class NotificationService {
  static async createNotification(data: Omit<Prisma.NotificationCreateInput, 'tenant'>) {
    return NotificationRepository.createNotification(requireTenantId(), data);
  }

  static async getMyNotifications(userId: string) {
    return NotificationRepository.findByUserId(requireTenantId(), userId);
  }

  /**
   * A notification belongs to whoever it was sent to — anyone else asking
   * for it (by guessing/enumerating ids) gets the same 404 as a
   * non-existent one, same convention as OrderService.getOrderDetails.
   */
  static async markAsRead(notificationId: string, userId: string) {
    const notification = await NotificationRepository.findById(notificationId);
    if (!notification || notification.userId !== userId) {
      return throwResponse(404, 'Notification not found');
    }
    return NotificationRepository.markAsRead(notificationId);
  }
}
