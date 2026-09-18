import express from 'express';
import { getAuditLogs, getJobs, getJobLogs } from './audit.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// AuditLog/Job/JobLog carry no tenantId — there's no way to scope these to
// "just this store" yet, so exposing them to a regular per-tenant admin role
// would leak every other tenant's activity. Restricted to platform roles
// until that's added; these previously had no auth at all.
router.get('/logs', authenticate, requirePermission('platform:manage'), getAuditLogs);
router.get('/jobs', authenticate, requirePermission('platform:manage'), getJobs);
router.get('/jobs/:jobId/logs', authenticate, requirePermission('platform:manage'), getJobLogs);

export default router;
