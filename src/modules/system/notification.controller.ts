import { Request, Response, NextFunction } from 'express';
import NotificationService from './notification.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';

export const getMyNotifications = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as unknown as { user: { id: string } }).user?.id;
    if (!userId) return responseError(res, 401, 'Unauthorized');
    const notifications = await NotificationService.getMyNotifications(userId);
    return responseSuccess(res, 200, notifications);
  } catch (error) {
    next(error);
  }
};

export const markAsRead = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const notification = await NotificationService.markAsRead(id);
    return responseSuccess(res, 200, notification);
  } catch (error) {
    next(error);
  }
};
