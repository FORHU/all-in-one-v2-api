import express from 'express';
import AuthController from './auth.controller';
import { authenticate } from '../../middleware/auth.middleware';

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/google', AuthController.googleLogin);
router.post('/refresh-token', AuthController.refreshToken);
router.post('/logout', authenticate, AuthController.logout);
router.get('/social', authenticate, AuthController.getSocialAccounts);
router.get('/files', authenticate, AuthController.getFiles);

export default router;
