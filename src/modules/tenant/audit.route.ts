import express from 'express';
import { getAuditLogs, getJobs, getJobLogs } from './audit.controller';

const router = express.Router();

router.get('/logs', getAuditLogs);
router.get('/jobs', getJobs);
router.get('/jobs/:jobId/logs', getJobLogs);

export default router;
