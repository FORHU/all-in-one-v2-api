import AuthRepo from '../repositories/auth.repository';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import logger from '../utils/logger';
import CacheUtil from '../utils/cache.util';
import { hashPassword, verifyPassword, isLegacyHash } from '../utils/password.util';

interface AuthUserPayload {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: UserRole;
  onboardingCompleted: boolean;
  avatar?: { fileUrl: string | null } | null;
}
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
} from '../config';

export default class AuthSvc {
  /**
   * Register a new user
   */
  static async register(data: {
    email: string;
    password: string;
    username: string;
    name?: string;
  }) {
    // Check if user already exists
    const existingUser = await AuthRepo.findUserByEmailOrUsername(data.email, data.username);
    if (existingUser) {
      if (existingUser.email === data.email)
        throw { status: 400, message: 'User with this email already exists' };
      throw { status: 400, message: 'Username is already taken' };
    }

    const hashedPassword = await hashPassword(data.password);

    // Create user (verified by default in simple boilerplate)
    const user = await AuthRepo.createUser({
      email: data.email,
      password: hashedPassword,
      username: data.username,
      name: data.name,
    });

    logger.info(`User registered: ${user.email}`);

    return this.generateAuthResponse(user, 'local');
  }

  /**
   * Login with email/password
   */
  static async login(data: { email: string; password: string }) {
    const user = await AuthRepo.findUserByEmail(data.email);
    if (!user) throw { status: 401, message: 'Invalid credentials' };

    if (!user.password) throw { status: 401, message: 'Account uses social login' };

    const isValid = await verifyPassword(data.password, user.password);
    if (!isValid) throw { status: 401, message: 'Invalid credentials' };

    // This is the only moment we hold the plaintext, so it's the only chance to
    // migrate an account off the old weak PBKDF2 hash.
    if (isLegacyHash(user.password)) {
      await AuthRepo.updateUser(user.id, { password: await hashPassword(data.password) });
      logger.info(`Upgraded legacy password hash for user ${user.id}`);
    }

    // Update login status and return response
    const updatedUser = await AuthRepo.updateUserLoginStatus(user.id);
    return this.generateAuthResponse(updatedUser || user, 'local');
  }

  /**
   * Refresh access token.
   *
   * The presented refresh token is single-use: its session is deleted and a new
   * token pair is issued. Callers must persist the returned `refreshToken` —
   * the old one stops working immediately.
   */
  static async refreshToken(refreshToken: string) {
    let decoded: { userId: string };

    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as { userId: string };
    } catch {
      throw { status: 401, message: 'Invalid refresh token' };
    }

    // The token must also correspond to a live session, and that session must
    // belong to the user the token claims to be.
    const session = await AuthRepo.findValidSession(refreshToken);
    if (!session || session.userId !== decoded.userId) {
      throw { status: 401, message: 'Invalid refresh token' };
    }

    const user = await AuthRepo.findUserById(decoded.userId);
    if (!user || user.isDeleted) throw { status: 401, message: 'Invalid refresh token' };

    await AuthRepo.deleteSession(refreshToken);

    return this.generateAuthResponse(user, session.provider || 'local');
  }

  /**
   * Logout (invalidate session and clear cache)
   */
  static async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await AuthRepo.deleteSession(refreshToken);
    }
    await CacheUtil.del(`user:${userId}`);
    return { message: 'Logged out successfully' };
  }

  /**
   * Internal helper to generate tokens and session
   */
  private static async generateAuthResponse(user: AuthUserPayload, provider: string) {
    const accessToken = jwt.sign({ userId: user.id }, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(
      { userId: user.id, jti: crypto.randomBytes(16).toString('hex') },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );

    await AuthRepo.createSession({
      userId: user.id,
      refreshToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      provider,
    });

    // Build the public shape once and cache *that*. Callers may hand us a full
    // Prisma User (the refresh path does), which carries the password hash —
    // that must never reach Redis or the response body.
    const publicUser = {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name,
      role: user.role,
      avatar: user.avatar?.fileUrl,
      onboardingCompleted: user.onboardingCompleted,
    };

    await CacheUtil.set(`user:${user.id}`, publicUser);

    return { accessToken, refreshToken, user: publicUser };
  }
}
