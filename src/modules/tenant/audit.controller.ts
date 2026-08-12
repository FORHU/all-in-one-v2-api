import { Request, Response, NextFunction } from 'express';
import AuditService from './audit.service';
import { responseSuccess } from '../../helpers/response.helper';

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await AuditService.getAuditLogs();
    return responseSuccess(res, 200, logs);
  } catch (error) {
    next(error);
  }
};

export const getJobs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const jobs = await AuditService.getJobs();
    return responseSuccess(res, 200, jobs);
  } catch (error) {
    next(error);
  }
};

export const getJobLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await AuditService.getJobLogs(req.params.jobId);
    return responseSuccess(res, 200, logs);
  } catch (error) {
    next(error);
  }
};
