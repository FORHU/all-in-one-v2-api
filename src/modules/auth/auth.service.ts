import { OAuth2Client } from 'google-auth-library';
import AuthRepo from './auth.repository';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';
import logger from '../../utils/logger';
import CacheUtil from '../../utils/cache.util';
import { hashPassword, verifyPassword, isLegacyHash } from '../../utils/password.util';
import {
  ACCESS_TOKEN_SECRET,
  REFRESH_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY,
  REFRESH_TOKEN_EXPIRY,
  GOOGLE_CLIENT_ID,
} from '../../config';

const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

export interface AuthUserPayload {
  id: string;
  email: string;
  username: string;
  name: string | null;
  role: UserRole;
  onboardingCompleted: boolean;
  avatar?: { fileUrl: string | null } | null;
}
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
    let decoded: { userId: string; sessionId: string };

    try {
      decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET) as {
        userId: string;
        sessionId: string;
      };
    } catch {
      throw { status: 401, message: 'Invalid refresh token' };
    }

    if (!decoded.sessionId) {
      throw { status: 401, message: 'Invalid refresh token payload' };
    }

    const session = await AuthRepo.findSessionById(decoded.sessionId);

    // If the session does not exist, or has expired
    if (!session || session.userId !== decoded.userId || session.expiresAt < new Date()) {
      throw { status: 401, message: 'Invalid or expired session' };
    }

    // Token Reuse Detection
    if (session.refreshTokenHash !== refreshToken) {
      logger.warn(
        `Token Reuse Detected! Revoking session ${decoded.sessionId} for user ${decoded.userId}`,
      );
      await AuthRepo.deleteSessionById(decoded.sessionId);
      throw { status: 401, message: 'Token reuse detected. Session revoked.' };
    }

    const user = await AuthRepo.findUserById(decoded.userId);
    if (!user || user.isDeleted) throw { status: 401, message: 'Invalid refresh token' };

    // Rotate the token for this session family
    return this.generateAuthResponse(user, session.provider || 'local', decoded.sessionId);
  }

  /**
   * Logout (invalidate session and clear cache)
   */
  static async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, {
          ignoreExpiration: true,
        }) as { sessionId?: string };
        if (decoded?.sessionId) {
          await AuthRepo.deleteSessionById(decoded.sessionId);
        }
      } catch (err) {
        logger.warn(`Failed to decode token during logout for user ${userId}`);
      }
    }
    await CacheUtil.del(`user:${userId}`);
    return { message: 'Logged out successfully' };
  }

  /**
   * Internal helper to generate tokens and session
   */
  private static async generateAuthResponse(
    user: AuthUserPayload,
    provider: string,
    existingSessionId?: string,
  ) {
    const sessionId = existingSessionId || crypto.randomUUID();

    const accessToken = jwt.sign({ userId: user.id }, ACCESS_TOKEN_SECRET, {
      expiresIn: ACCESS_TOKEN_EXPIRY as jwt.SignOptions['expiresIn'],
    });

    const refreshToken = jwt.sign(
      { userId: user.id, sessionId, jti: crypto.randomBytes(16).toString('hex') },
      REFRESH_TOKEN_SECRET,
      { expiresIn: REFRESH_TOKEN_EXPIRY },
    );

    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    if (existingSessionId) {
      await AuthRepo.updateSession(sessionId, { refreshTokenHash: refreshToken, expiresAt });
    } else {
      await AuthRepo.createSession({
        id: sessionId,
        userId: user.id,
        refreshTokenHash: refreshToken,
        expiresAt,
        provider,
      });
    }

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

  static async loginWithGoogle(idToken: string) {
    if (!idToken) throw { status: 400, message: 'idToken is required' };

    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: GOOGLE_CLIENT_ID || undefined,
      });
      payload = ticket.getPayload();
    } catch {
      throw { status: 401, message: 'Invalid Google ID token' };
    }

    if (!payload || !payload.email) {
      throw { status: 401, message: 'Invalid Google token payload' };
    }

    if (!payload.email_verified) {
      throw { status: 401, message: 'Google email is not verified' };
    }

    const { email, sub: googleUserId, name, picture } = payload;

    // 1. Check if social account already exists for Google
    const socialAccount = await AuthRepo.findSocialAccount('google', googleUserId);
    let user;

    if (socialAccount) {
      user = socialAccount.user;
    } else {
      // 2. Check if AuthUser exists with this email (Unified Identity Model)
      user = await AuthRepo.findUserByEmail(email);

      if (!user) {
        // Create brand new user
        const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
        const username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;

        user = await AuthRepo.createUser({
          email,
          username,
          name: name || baseUsername,
          password: undefined, // Passwordless social user
        });
      } else {
        // Ensure user is marked verified if Google verified it
        if (!user.isEmailVerified) {
          await AuthRepo.updateUser(user.id, { isEmailVerified: true });
        }
      }

      // 3. Link Google social account to the user
      await AuthRepo.createSocialAccount({
        userId: user.id,
        platform: 'google',
        providerUserId: googleUserId,
        accessToken: idToken,
        avatarUrl: picture,
      });
    }

    if (!user.isActive || user.isDeleted) {
      throw { status: 401, message: 'Account is inactive or deleted' };
    }

    await AuthRepo.updateUser(user.id, { lastLoginAt: new Date() });

    return this.generateAuthResponse(user, 'google');
  }

  static async getSocialAccounts(userId: string) {
    return AuthRepo.getSocialAccounts(userId);
  }

  static async getFiles() {
    return AuthRepo.getFiles();
  }
}
