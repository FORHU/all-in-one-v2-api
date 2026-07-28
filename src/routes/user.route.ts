import express from 'express';
import UserController from '../controllers/user.controller';
import { authenticate, authorize, ADMIN_ROLES } from '../middleware/auth.middleware';

const router = express.Router();

router.get('/me', authenticate, UserController.getMe);

// Listing and creating users are admin operations. Public signup goes through
// POST /api/v2/auth/register, which hashes passwords and issues tokens.
router.get('/', authenticate, authorize(...ADMIN_ROLES), UserController.index);
router.post('/', authenticate, authorize(...ADMIN_ROLES), UserController.create);

export default router;
