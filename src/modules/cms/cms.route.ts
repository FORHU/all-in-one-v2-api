import express from 'express';
import CMSController from './cms.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

router.get('/pages/:slug', CMSController.getPage);
router.get('/banners', CMSController.getBanners);
router.get('/announcements', CMSController.getAnnouncements);
router.get('/faqs', CMSController.getFAQs);

router.post(
  '/banners',
  authenticate,
  requirePermission('catalog:write'),
  CMSController.createBanner,
);
router.post(
  '/announcements',
  authenticate,
  requirePermission('catalog:write'),
  CMSController.createAnnouncement,
);
router.post('/faqs', authenticate, requirePermission('catalog:write'), CMSController.createFAQ);

export default router;
