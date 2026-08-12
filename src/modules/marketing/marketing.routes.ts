import { Router } from 'express';
import MarketingController from './marketing.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = Router();

// --- Public Endpoints ---
router.get('/links/:code', MarketingController.resolveLink);
router.post('/ads/:adId/click', MarketingController.trackAdClick);

// --- Store Admin Endpoints ---
router.post(
  '/feeds',
  authenticate,
  requirePermission('catalog:write'),
  MarketingController.createFeed,
);
router.get(
  '/feeds',
  authenticate,
  requirePermission('catalog:read'),
  MarketingController.listFeeds,
);

router.post('/ads', authenticate, requirePermission('catalog:write'), MarketingController.createAd);
router.get('/ads', authenticate, requirePermission('catalog:read'), MarketingController.listAds);

router.post(
  '/links',
  authenticate,
  requirePermission('catalog:write'),
  MarketingController.createLink,
);

export default router;
