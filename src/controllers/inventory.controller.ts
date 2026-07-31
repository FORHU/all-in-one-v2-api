import { Request, Response, NextFunction } from 'express';
import InventoryService from '../services/inventory.service';
import { responseSuccess } from '../helpers/response.helper';

export default class InventoryController {
  static async listLocations(req: Request, res: Response, next: NextFunction) {
    try {
      const locations = await InventoryService.getLocations();
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
}
