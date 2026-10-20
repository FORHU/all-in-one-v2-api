import express from 'express';
import MembershipController from './membership.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

// Literal paths declared before any `/:id` route on this router, mirroring
// tenant.route.ts's `/all`-before-`/:slug` convention.
router.get('/mine', authenticate, MembershipController.mine);
router.get('/all', authenticate, requirePermission('platform:manage'), MembershipController.all);

// Tenant-scoped: `requirePermission` checks the ambient tenant's membership,
// so these always operate on the caller's own store (or, for a platform
// admin, whichever store the request is scoped to via x-tenant-slug/host).
// Listing is read-only, so it only requires tenant_staff:read — a plain
// ADMIN can see who's on the roster without being able to change it.
router.get('/', authenticate, requirePermission('tenant_staff:read'), MembershipController.index);
router.post(
  '/',
  authenticate,
  requirePermission('tenant_staff:manage'),
  MembershipController.create,
);
router.patch(
  '/:id',
  authenticate,
  requirePermission('tenant_staff:manage'),
  MembershipController.update,
);
router.delete(
  '/:id',
  authenticate,
  requirePermission('tenant_staff:manage'),
  MembershipController.remove,
);

export default router;
