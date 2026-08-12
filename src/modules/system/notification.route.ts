import express from 'express';
import { getMyNotifications, markAsRead } from './notification.controller';

const router = express.Router();

router.get('/my', getMyNotifications);
router.patch('/:id/read', markAsRead);

export default router;
