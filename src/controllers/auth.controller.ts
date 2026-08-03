import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import AuthService, { AuthUserPayload } from '../services/auth.service';
import { responseSuccess } from '../helpers/response.helper';

export default class AuthController {
  /**
   * Register a new user
   */
  static async register(req: Request, res: Response, next: NextFunction) {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(6).required(),
      username: Joi.string().required(),
      name: Joi.string().optional(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    try {
      const result = await AuthService.register(value);
      return res.status(201).json({ message: 'User created successfully', data: result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Login with email/password
   */
  static async login(req: Request, res: Response, next: NextFunction) {
    const schema = Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    try {
      const data = await AuthService.login(value);
      return res.json({ message: 'Login successful', data });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(req: Request, res: Response, next: NextFunction) {
    const schema = Joi.object({
      refreshToken: Joi.string().required(),
    });

    const { error, value } = schema.validate(req.body);
    if (error) return res.status(400).json({ message: error.message });

    try {
      const result = await AuthService.refreshToken(value.refreshToken);
      return res.json(result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Logout
   */
  static async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const { refreshToken } = req.body;
      const userId = (req.user as AuthUserPayload)?.id;
      if (!userId) return res.status(401).json({ message: 'Unauthorized' });
      await AuthService.logout(userId, refreshToken);
      return responseSuccess(res, 204, null, 'Logged out successfully');
    } catch (error) {
      next(error);
    }
  }

  static async getSocialAccounts(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req.user as AuthUserPayload)?.id;
      const accounts = await AuthService.getSocialAccounts(userId);
      return responseSuccess(res, 200, accounts);
    } catch (error) {
      next(error);
    }
  }

  static async getFiles(req: Request, res: Response, next: NextFunction) {
    try {
      const files = await AuthService.getFiles();
      return responseSuccess(res, 200, files);
    } catch (error) {
      next(error);
    }
  }
}
