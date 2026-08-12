import { Request, Response, NextFunction } from 'express';
import InventoryService from './inventory.service';
import { responseSuccess } from '../../helpers/response.helper';
import { parsePagination } from '../../helpers/pagination.helper';

export default class InventoryController {
  static async listLocations(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, search, sortBy, sortOrder } = parsePagination(
        req.query as Record<string, unknown>,
      );
      const locations = await InventoryService.getLocations(page, limit, search, sortBy, sortOrder);
      return responseSuccess(res, 200, locations);
    } catch (error) {
      next(error);
    }
  }

  static async getLocationById(req: Request, res: Response, next: NextFunction) {
    try {
      const location = await InventoryService.getLocationById(req.params.id);
      return responseSuccess(res, 200, location);
    } catch (error) {
      next(error);
    }
  }

  static async createLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const location = await InventoryService.createLocation(req.body);
      return responseSuccess(res, 201, location, 'Inventory location created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async updateLocation(req: Request, res: Response, next: NextFunction) {
    try {
      const location = await InventoryService.updateLocation(req.params.id, req.body);
      return responseSuccess(res, 200, location, 'Inventory location updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getVariantStock(req: Request, res: Response, next: NextFunction) {
    try {
      const summary = await InventoryService.getVariantStockSummary(req.params.variantId);
      return responseSuccess(res, 200, summary);
    } catch (error) {
      next(error);
    }
  }

  static async setStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId, locationId, onHand, reorderPoint } = req.body;
      const stock = await InventoryService.setStock(variantId, locationId, onHand, reorderPoint);
      return responseSuccess(res, 200, stock, 'Inventory stock updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getTransactions(req: Request, res: Response, next: NextFunction) {
    try {
      const { page, limit, sortBy, sortOrder } = parsePagination(
        req.query as Record<string, unknown>,
      );
      const { locationId, variantId } = req.query;
      const transactions = await InventoryService.getTransactions(
        locationId as string | undefined,
        variantId as string | undefined,
        page,
        limit,
        sortBy,
        sortOrder,
      );
      return responseSuccess(res, 200, transactions);
    } catch (error) {
      next(error);
    }
  }
}
