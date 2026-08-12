import { Request, Response, NextFunction } from 'express';
import MarketingService from './marketing.service';
import { responseSuccess } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';
import { AdSocialPlatform, AdSocialStatus } from '@prisma/client';

export default class MarketingController {
  // --- Social Feeds ---
  static async createFeed(req: Request, res: Response, next: NextFunction) {
    try {
      const feed = await MarketingService.createFeed(req.body);
      return responseSuccess(res, 201, feed, 'Product social feed created');
    } catch (error) {
      next(error);
    }
  }

  static async listFeeds(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const feeds = await MarketingService.listFeeds(page, limit);
      return responseSuccess(res, 200, feeds, 'Product social feeds retrieved');
    } catch (error) {
      next(error);
    }
  }

  // --- Social Ads ---
  static async createAd(req: Request, res: Response, next: NextFunction) {
    try {
      const ad = await MarketingService.createAd(req.body);
      return responseSuccess(res, 201, ad, 'Product social ad campaign created');
    } catch (error) {
      next(error);
    }
  }

  static async listAds(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit } = parsePagination(req.query);
      const platform = req.query.platform as AdSocialPlatform | undefined;
      const status = req.query.status as AdSocialStatus | undefined;
      const ads = await MarketingService.listAds(platform, status, page, limit);
      return responseSuccess(res, 200, ads, 'Product social ads retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async trackAdClick(req: Request, res: Response, next: NextFunction) {
    try {
      const { adId } = req.params;
      const updated = await MarketingService.trackAdClick(adId);
      return responseSuccess(res, 200, updated, 'Ad click recorded');
    } catch (error) {
      next(error);
    }
  }

  // --- Shareable Links ---
  static async createLink(req: Request, res: Response, next: NextFunction) {
    try {
      const link = await MarketingService.createShareableLink(req.body);
      return responseSuccess(res, 201, link, 'Shareable marketing link created');
    } catch (error) {
      next(error);
    }
  }

  static async resolveLink(req: Request, res: Response, next: NextFunction) {
    try {
      const { code } = req.params;
      const link = await MarketingService.resolveShareableLink(code);
      return responseSuccess(res, 200, link, 'Shareable link resolved');
    } catch (error) {
      next(error);
    }
  }
}
