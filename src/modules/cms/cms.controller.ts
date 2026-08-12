import { Request, Response, NextFunction } from 'express';
import CMSService from './cms.service';
import { responseSuccess } from '../../helpers/response.helper';

export default class CMSController {
  static async getPage(req: Request, res: Response, next: NextFunction) {
    try {
      const page = await CMSService.getPage(req.params.slug);
      return responseSuccess(res, 200, page);
    } catch (error) {
      next(error);
    }
  }

  static async getBanners(_req: Request, res: Response, next: NextFunction) {
    try {
      const banners = await CMSService.getBanners();
      return responseSuccess(res, 200, banners);
    } catch (error) {
      next(error);
    }
  }

  static async getAnnouncements(_req: Request, res: Response, next: NextFunction) {
    try {
      const announcements = await CMSService.getAnnouncements();
      return responseSuccess(res, 200, announcements);
    } catch (error) {
      next(error);
    }
  }

  static async getFAQs(req: Request, res: Response, next: NextFunction) {
    try {
      const category = req.query.category as string | undefined;
      const faqs = await CMSService.getFAQs(category);
      return responseSuccess(res, 200, faqs);
    } catch (error) {
      next(error);
    }
  }

  static async createBanner(req: Request, res: Response, next: NextFunction) {
    try {
      const banner = await CMSService.createBanner(req.body);
      return responseSuccess(res, 201, banner, 'Banner created');
    } catch (error) {
      next(error);
    }
  }

  static async createAnnouncement(req: Request, res: Response, next: NextFunction) {
    try {
      const announcement = await CMSService.createAnnouncement(req.body);
      return responseSuccess(res, 201, announcement, 'Announcement created');
    } catch (error) {
      next(error);
    }
  }

  static async createFAQ(req: Request, res: Response, next: NextFunction) {
    try {
      const faq = await CMSService.createFAQ(req.body);
      return responseSuccess(res, 201, faq, 'FAQ created');
    } catch (error) {
      next(error);
    }
  }
}
