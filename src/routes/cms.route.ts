import express from 'express';
import CMSController from '../controllers/cms.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/pages/:slug', CMSController.getPage);
router.get('/banners', CMSController.getBanners);
router.get('/announcements', CMSController.getAnnouncements);
router.get('/faqs', CMSController.getFAQs);

router.post('/banners', authenticate, CMSController.createBanner);
router.post('/announcements', authenticate, CMSController.createAnnouncement);
router.post('/faqs', authenticate, CMSController.createFAQ);

export default router;
