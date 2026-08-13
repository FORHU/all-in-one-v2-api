import express from 'express';
import { getMyNotifications, markAsRead } from './notification.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = express.Router();

// Both routes read req.user, which only `authenticate` populates — without
// it getMyNotifications' `req.user?.id` check is always undefined and every
// call 401s.
router.get('/my', authenticate, getMyNotifications);
router.patch('/:id/read', authenticate, markAsRead);

export default router;
