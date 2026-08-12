import { Prisma } from '@prisma/client';
import { prisma } from '../../utils/prisma';

export default class AuthRepo {
  static async findUserByEmailOrUsername(email: string, username: string) {
    return prisma.authUser.findFirst({
      where: {
        OR: [{ email }, { username }],
        isDeleted: false,
      },
    });
  }

  static async createUser(data: {
    email: string;
    password?: string;
    username: string;
    name?: string;
  }) {
    return prisma.authUser.create({
      data: {
        email: data.email,
        password: data.password,
        username: data.username,
        name: data.name,
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        isDeleted: true,
        isEmailVerified: true,
        onboardingCompleted: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  static async findUserByEmail(email: string) {
    return prisma.authUser.findFirst({
      where: {
        email,
        isDeleted: false,
      },
      include: {
        avatar: {
          select: {
            fileUrl: true,
          },
        },
      },
    });
  }

  static async updateUserLoginStatus(userId: string) {
    return prisma.authUser.update({
      where: {
        id: userId,
        isDeleted: false,
      },
      data: {
        isActive: true,
        lastLoginAt: new Date(),
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        username: true,
        name: true,
        role: true,
        isActive: true,
        avatar: {
          select: {
            fileUrl: true,
          },
        },
        lastLoginAt: true,
        onboardingCompleted: true,
      },
    });
  }

  static async findUserById(userId: string) {
    return prisma.authUser.findFirst({
      where: {
        id: userId,
        isDeleted: false,
      },
      include: {
        avatar: {
          select: {
            fileUrl: true,
          },
        },
      },
    });
  }

  static async findUserByUsername(username: string) {
    return prisma.authUser.findFirst({
      where: {
        username,
        isDeleted: false,
      },
    });
  }

  static async createSession(data: {
    id?: string;
    userId: string;
    refreshTokenHash: string;
    expiresAt: Date;
    provider?: string;
    providerUserId?: string;
    providerAvatarUrl?: string;
  }) {
    return prisma.authSession.create({
      data: {
        ...data,
      },
    });
  }

  static async findSessionById(sessionId: string) {
    return prisma.authSession.findUnique({
      where: { id: sessionId },
      include: { user: true },
    });
  }

  static async updateSession(
    sessionId: string,
    data: { refreshTokenHash: string; expiresAt: Date },
  ) {
    return prisma.authSession.update({
      where: { id: sessionId },
      data,
    });
  }

  static async deleteSessionById(sessionId: string) {
    return prisma.authSession.delete({
      where: { id: sessionId },
    });
  }

  static async getSocialAccounts(userId: string) {
    return prisma.authSocialAccount.findMany({
      where: { userId },
    });
  }

  static async findSocialAccount(platform: string, providerUserId: string) {
    return prisma.authSocialAccount.findUnique({
      where: {
        platform_providerUserId: {
          platform,
          providerUserId,
        },
      },
      include: { user: true },
    });
  }

  static async createSocialAccount(data: {
    userId: string;
    platform: string;
    providerUserId: string;
    accessToken: string;
    avatarUrl?: string;
  }) {
    return prisma.authSocialAccount.create({
      data,
    });
  }

  static async getFiles() {
    return prisma.authFile.findMany({
      take: 10,
    });
  }

  static async updateUser(userId: string, data: Prisma.AuthUserUpdateInput) {
    return prisma.authUser.update({
      where: {
        id: userId,
      },
      data: data,
    });
  }

  static async getAuthUser(userId: string) {
    return prisma.authUser.findUnique({
      where: {
        id: userId,
      },
      select: {
        id: true,
        name: true,
        avatar: true,
        username: true,
        role: true,
        onboardingCompleted: true,
      },
    });
  }
}
