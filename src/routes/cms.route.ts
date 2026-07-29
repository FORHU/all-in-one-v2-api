import express from 'express';
import CMSController from '../controllers/cms.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/pages/:slug', CMSController.getPage);
router.get('/banners', CMSController.getBanners);
router.get('/announcements', CMSController.getAnnouncements);
router.get('/faqs', CMSController.getFAQs);

router.post('/banners', authenticate, authorize(...ADMIN_ROLES), CMSController.createBanner);
router.post(
  '/announcements',
  authenticate,
  authorize(...ADMIN_ROLES),
  CMSController.createAnnouncement,
);
router.post('/faqs', authenticate, authorize(...ADMIN_ROLES), CMSController.createFAQ);

export default router;
