import { Request, Response, NextFunction } from 'express';
import SupplierService from '../services/supplier.service';
import { responseSuccess } from '../helpers/response.helper';

export const createPartner = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partner = await SupplierService.createPartner(req.body);
    return responseSuccess(res, 201, partner);
  } catch (error) {
    next(error);
  }
};

export const getPartners = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const partners = await SupplierService.getPartners();
    return responseSuccess(res, 200, partners);
  } catch (error) {
    next(error);
  }
};

export const getSyncJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await SupplierService.getSyncJobs();
    return responseSuccess(res, 200, jobs);
  } catch (error) {
    next(error);
  }
};

export const updateCredentials = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { partnerId } = req.params;
    const { apiKey, apiSecret } = req.body;
    const creds = await SupplierService.updateCredentials(partnerId, apiKey, apiSecret);
    return responseSuccess(res, 200, creds);
  } catch (error) {
    next(error);
  }
};

export const getSyncLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jobId } = req.params;
    const logs = await SupplierService.getSyncLogs(jobId);
    return responseSuccess(res, 200, logs);
  } catch (error) {
    next(error);
  }
};

export const getSupplierCatalog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { partnerId } = req.params;
    const catalog = await SupplierService.getSupplierCatalog(partnerId);
    return responseSuccess(res, 200, catalog);
  } catch (error) {
    next(error);
  }
};

export const searchSupplierProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { supplierId } = req.params;
    const { q } = req.query;
    const results = await SupplierService.searchSupplier(supplierId, String(q || ''));
    return responseSuccess(res, 200, results);
  } catch (error) {
    next(error);
  }
};

export const getSupplierProductDetails = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const { supplierId, externalId } = req.params;
    const product = await SupplierService.getSupplierProduct(supplierId, externalId);
    return responseSuccess(res, 200, product);
  } catch (error) {
    next(error);
  }
};

export const getAvailableSuppliers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const suppliers = await SupplierService.getAvailableSuppliers();
    return responseSuccess(res, 200, suppliers);
  } catch (error) {
    next(error);
  }
};
