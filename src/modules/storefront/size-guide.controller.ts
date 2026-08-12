import { Request, Response, NextFunction } from 'express';
import SizeGuideService from './size-guide.service';
import { responseSuccess } from '../../helpers/response.helper';

export default class SizeGuideController {
  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const guide = await SizeGuideService.getGuideById(req.params.id);
      return responseSuccess(res, 200, guide);
    } catch (error) {
      next(error);
    }
  }

  static async getByProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const guides = await SizeGuideService.getGuidesByProduct(req.params.productId);
      return responseSuccess(res, 200, guides);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const guide = await SizeGuideService.createGuide(req.body);
      return responseSuccess(res, 201, guide, 'Size guide created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const guide = await SizeGuideService.updateGuide(req.params.id, req.body);
      return responseSuccess(res, 200, guide, 'Size guide updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await SizeGuideService.deleteGuide(req.params.id);
      return responseSuccess(res, 200, null, 'Size guide deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  // ─── Entry Endpoints ────────────────────────────────────────────────────────

  static async addEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await SizeGuideService.addEntry(req.params.guideId, req.body);
      return responseSuccess(res, 201, entry, 'Size entry added successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateEntry(req: Request, res: Response, next: NextFunction) {
    try {
      const entry = await SizeGuideService.updateEntry(req.params.entryId, req.body);
      return responseSuccess(res, 200, entry, 'Size entry updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteEntry(req: Request, res: Response, next: NextFunction) {
    try {
      await SizeGuideService.deleteEntry(req.params.entryId);
      return responseSuccess(res, 200, null, 'Size entry deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async linkVariant(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId, sizeEntryId } = req.body;
      const updated = await SizeGuideService.linkVariant(variantId, sizeEntryId);
      return responseSuccess(res, 200, updated, 'Variant linked to size entry successfully');
    } catch (error) {
      next(error);
    }
  }
}
