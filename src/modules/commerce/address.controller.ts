import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import AddressService from './address.service';
import { responseSuccess, responseError } from '../../helpers/response.helper';
import { resolveCustomerId } from '../../helpers/requester.helper';

const saveAddressSchema = Joi.object({
  fullName: Joi.string().required(),
  addressLine1: Joi.string().required(),
  addressLine2: Joi.string().allow('').optional(),
  city: Joi.string().required(),
  state: Joi.string().allow('').optional(),
  postalCode: Joi.string().required(),
  country: Joi.string().required(),
  phone: Joi.string().allow('').optional(),
});

export default class AddressController {
  /**
   * GET /api/v2/addresses/latest
   * Returns the signed-in customer's most recently saved address (or null
   * on a first-time checkout, when none exists yet), so checkout can
   * pre-fill it instead of asking for the address again every time.
   */
  static async getLatest(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = await resolveCustomerId(req);
      if (!customerId) return responseError(res, 401, 'Unauthorized');

      const address = await AddressService.getLatestAddress(customerId);
      return responseSuccess(res, 200, address);
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/v2/addresses
   * Saves a new address for the signed-in customer. Insert-only — each
   * save creates a new row rather than overwriting the previous one, so
   * past orders keep an accurate historical snapshot of the address they
   * actually shipped to (CommerceOrder.shippingAddressId). "Latest" is
   * simply the most recently created row.
   */
  static async create(req: Request, res: Response, next: NextFunction) {
    const { error, value } = saveAddressSchema.validate(req.body);
    if (error) return responseError(res, 400, error.message);

    try {
      const customerId = await resolveCustomerId(req);
      if (!customerId) return responseError(res, 401, 'Unauthorized');

      const address = await AddressService.saveAddress(customerId, value);
      return responseSuccess(res, 201, address, 'Address saved');
    } catch (err) {
      next(err);
    }
  }
}
