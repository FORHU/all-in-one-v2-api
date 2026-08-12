import express from 'express';
import UserController from './user.controller';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';

const router = express.Router();

router.get('/me', authenticate, UserController.getMe);

// Listing and creating users are admin operations. Public signup goes through
// POST /api/v2/auth/register, which hashes passwords and issues tokens.
router.get('/', authenticate, requirePermission('platform:manage'), UserController.index);
router.post('/', authenticate, requirePermission('platform:manage'), UserController.create);

export default router;
