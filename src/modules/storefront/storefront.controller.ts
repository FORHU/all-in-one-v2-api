import { Request, Response, NextFunction } from 'express';
import { StorefrontPageType, StorefrontContextType } from '@prisma/client';
import StorefrontService from './storefront.service';
import { responseSuccess } from '../../helpers/response.helper';
import { throwResponse } from '../../utils/throw-response';

export default class StorefrontController {
  /**
   * GET /v2/storefront?pageType=HOME
   * GET /v2/storefront?slug=black-friday-sale
   * GET /v2/storefront?pageType=CATEGORY&contextType=CATEGORY&contextId=abc
   *
   * Returns the fully populated, cached layout for the requested page.
   */
  static async getPage(req: Request, res: Response, next: NextFunction) {
    try {
      const { slug, pageType, contextType, contextId, customerId, locale, currency } =
        req.query as Record<string, string | undefined>;

      if (!slug && !pageType) {
        return throwResponse(400, 'Must provide either "slug" or "pageType" query parameter');
      }

      let parsedPageType: StorefrontPageType | undefined;
      if (pageType) {
        parsedPageType = pageType.toUpperCase() as StorefrontPageType;
        if (!Object.values(StorefrontPageType).includes(parsedPageType)) {
          return throwResponse(
            400,
            `Invalid pageType. Valid values: ${Object.values(StorefrontPageType).join(', ')}`,
          );
        }
      }

      let parsedContextType: StorefrontContextType | undefined;
      if (contextType) {
        parsedContextType = contextType.toUpperCase() as StorefrontContextType;
        if (!Object.values(StorefrontContextType).includes(parsedContextType)) {
          return throwResponse(
            400,
            `Invalid contextType. Valid values: ${Object.values(StorefrontContextType).join(', ')}`,
          );
        }
      }

      const result = await StorefrontService.getPage({
        slug,
        pageType: parsedPageType,
        contextType: parsedContextType,
        contextId,
        customerId,
        locale,
        currency,
      });

      return responseSuccess(res, 200, result);
    } catch (error) {
      next(error);
    }
  }

  // ─── Admin Page Management ──────────────────────────────────────────────────

  static async createPage(req: Request, res: Response, next: NextFunction) {
    try {
      const page = await StorefrontService.createPage(req.body);
      return responseSuccess(res, 201, page, 'Storefront page created');
    } catch (error) {
      next(error);
    }
  }

  static async updatePage(req: Request, res: Response, next: NextFunction) {
    try {
      const page = await StorefrontService.updatePage(req.params.id, req.body);
      return responseSuccess(res, 200, page, 'Storefront page updated');
    } catch (error) {
      next(error);
    }
  }

  static async deletePage(req: Request, res: Response, next: NextFunction) {
    try {
      await StorefrontService.deletePage(req.params.id);
      return responseSuccess(res, 200, null, 'Storefront page deleted');
    } catch (error) {
      next(error);
    }
  }

  // ─── Admin Section Management ────────────────────────────────────────────────

  static async getSectionById(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await StorefrontService.getSectionById(req.params.id);
      return responseSuccess(res, 200, section);
    } catch (error) {
      next(error);
    }
  }

  static async createSection(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await StorefrontService.createSection(req.body);
      return responseSuccess(res, 201, section, 'Storefront section created');
    } catch (error) {
      next(error);
    }
  }

  static async updateSection(req: Request, res: Response, next: NextFunction) {
    try {
      const section = await StorefrontService.updateSection(req.params.id, req.body);
      return responseSuccess(res, 200, section, 'Storefront section updated');
    } catch (error) {
      next(error);
    }
  }

  static async deleteSection(req: Request, res: Response, next: NextFunction) {
    try {
      await StorefrontService.deleteSection(req.params.id);
      return responseSuccess(res, 200, null, 'Storefront section deleted');
    } catch (error) {
      next(error);
    }
  }

  static async addPinnedItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, position } = req.body;
      const item = await StorefrontService.addPinnedItem(req.params.sectionId, productId, position);
      return responseSuccess(res, 201, item, 'Pinned item added');
    } catch (error) {
      next(error);
    }
  }

  static async removePinnedItem(req: Request, res: Response, next: NextFunction) {
    try {
      await StorefrontService.removePinnedItem(req.params.sectionId, req.params.itemId);
      return responseSuccess(res, 200, null, 'Pinned item removed');
    } catch (error) {
      next(error);
    }
  }
}
