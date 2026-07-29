import { Router } from 'express';
import MarketingController from '../controllers/marketing.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = Router();

// --- Public Endpoints ---
router.get('/links/:code', MarketingController.resolveLink);
router.post('/ads/:adId/click', MarketingController.trackAdClick);

// --- Store Admin Endpoints ---
router.post('/feeds', authenticate, authorize(...ADMIN_ROLES), MarketingController.createFeed);
router.get('/feeds', authenticate, authorize(...ADMIN_ROLES), MarketingController.listFeeds);

router.post('/ads', authenticate, authorize(...ADMIN_ROLES), MarketingController.createAd);
router.get('/ads', authenticate, authorize(...ADMIN_ROLES), MarketingController.listAds);

router.post('/links', authenticate, authorize(...ADMIN_ROLES), MarketingController.createLink);

export default router;
