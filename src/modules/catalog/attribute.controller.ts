import { Request, Response, NextFunction } from 'express';
import AttributeService from './attribute.service';
import { responseSuccess } from '../../helpers/response.helper';

export default class AttributeController {
  static async list(req: Request, res: Response, next: NextFunction) {
    try {
      const attributes = await AttributeService.getAttributes();
      return responseSuccess(res, 200, attributes);
    } catch (error) {
      next(error);
    }
  }

  static async getById(req: Request, res: Response, next: NextFunction) {
    try {
      const attribute = await AttributeService.getAttributeById(req.params.id);
      return responseSuccess(res, 200, attribute);
    } catch (error) {
      next(error);
    }
  }

  static async create(req: Request, res: Response, next: NextFunction) {
    try {
      const attribute = await AttributeService.createAttribute(req.body);
      return responseSuccess(res, 201, attribute, 'Catalog attribute created successfully');
    } catch (error) {
      next(error);
    }
  }

  static async update(req: Request, res: Response, next: NextFunction) {
    try {
      const attribute = await AttributeService.updateAttribute(req.params.id, req.body);
      return responseSuccess(res, 200, attribute, 'Catalog attribute updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async delete(req: Request, res: Response, next: NextFunction) {
    try {
      await AttributeService.deleteAttribute(req.params.id);
      return responseSuccess(res, 200, null, 'Catalog attribute deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async addValue(req: Request, res: Response, next: NextFunction) {
    try {
      const value = await AttributeService.addValue(req.params.id, req.body);
      return responseSuccess(res, 201, value, 'Attribute value added successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteValue(req: Request, res: Response, next: NextFunction) {
    try {
      await AttributeService.deleteValue(req.params.valueId);
      return responseSuccess(res, 200, null, 'Attribute value deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async setVariantAttributes(req: Request, res: Response, next: NextFunction) {
    try {
      const { variantId, valueIds } = req.body;
      const result = await AttributeService.setVariantAttributes(variantId, valueIds);
      return responseSuccess(res, 200, result, 'Variant attributes updated successfully');
    } catch (error) {
      next(error);
    }
  }
}
