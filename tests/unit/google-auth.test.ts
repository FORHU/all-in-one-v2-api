import { AuthUser, AuthSocialAccount, UserRole } from '@prisma/client';
import AuthSvc from '../../src/modules/auth/auth.service';
import AuthRepo from '../../src/modules/auth/auth.repository';

const mockVerifyIdToken = jest.fn();
jest.mock('google-auth-library', () => {
  return {
    OAuth2Client: jest.fn().mockImplementation(() => ({
      verifyIdToken: (...args: unknown[]) => mockVerifyIdToken(...args),
    })),
  };
});

describe('Google OAuth SSO Login', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('throws 400 if idToken is missing', async () => {
    await expect(AuthSvc.loginWithGoogle('')).rejects.toEqual({
      status: 400,
      message: 'idToken is required',
    });
  });

  it('throws 401 if token verification fails', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('Invalid token'));
    await expect(AuthSvc.loginWithGoogle('invalid_token')).rejects.toEqual({
      status: 401,
      message: 'Invalid Google ID token',
    });
  });

  it('throws 401 if Google email is not verified', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: 'unverified@example.com',
        email_verified: false,
        sub: 'google_12345',
      }),
    });

    await expect(AuthSvc.loginWithGoogle('valid_token')).rejects.toEqual({
      status: 401,
      message: 'Google email is not verified',
    });
  });

  it('links Google account to existing user by email (Unified Model)', async () => {
    const mockUser = {
      id: 'usr_existing_123',
      email: 'existing@example.com',
      username: 'existing_user',
      name: 'Existing User',
      password: null,
      role: UserRole.USER,
      isActive: true,
      isDeleted: false,
      isEmailVerified: true,
      onboardingCompleted: true,
      avatarId: null,
      avatar: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: 'existing@example.com',
        email_verified: true,
        sub: 'google_sub_999',
        name: 'Existing User',
        picture: 'https://lh3.googleusercontent.com/avatar.jpg',
      }),
    });

    jest.spyOn(AuthRepo, 'findSocialAccount').mockResolvedValueOnce(null);
    jest
      .spyOn(AuthRepo, 'findUserByEmail')
      .mockResolvedValueOnce(mockUser as unknown as AuthUser & { avatar: null });
    jest.spyOn(AuthRepo, 'createSocialAccount').mockResolvedValueOnce({} as AuthSocialAccount);
    jest.spyOn(AuthRepo, 'updateUser').mockResolvedValueOnce(mockUser as AuthUser);

    jest.spyOn(AuthSvc, 'generateAuthResponse' as 'login').mockImplementationOnce(() =>
      Promise.resolve({
        accessToken: 'access_jwt',
        refreshToken: 'refresh_jwt',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          name: mockUser.name,
          role: mockUser.role,
          avatar: undefined,
          onboardingCompleted: mockUser.onboardingCompleted,
        },
      } as never),
    );

    const result = await AuthSvc.loginWithGoogle('valid_google_token');

    expect(AuthRepo.findUserByEmail).toHaveBeenCalledWith('existing@example.com');
    expect(AuthRepo.createSocialAccount).toHaveBeenCalledWith({
      userId: 'usr_existing_123',
      platform: 'google',
      providerUserId: 'google_sub_999',
      accessToken: 'valid_google_token',
      avatarUrl: 'https://lh3.googleusercontent.com/avatar.jpg',
    });
    expect(result.accessToken).toBe('access_jwt');
  });

  it('creates brand new user and links social account when user does not exist', async () => {
    const newMockUser = {
      id: 'usr_new_777',
      email: 'newuser@example.com',
      username: 'newuser_1234',
      name: 'New User',
      password: null,
      role: UserRole.USER,
      isActive: true,
      isDeleted: false,
      isEmailVerified: true,
      onboardingCompleted: true,
      avatarId: null,
      avatar: null,
      lastLoginAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({
        email: 'newuser@example.com',
        email_verified: true,
        sub: 'google_sub_888',
        name: 'New User',
        picture: 'https://lh3.googleusercontent.com/avatar.jpg',
      }),
    });

    jest.spyOn(AuthRepo, 'findSocialAccount').mockResolvedValueOnce(null);
    jest.spyOn(AuthRepo, 'findUserByEmail').mockResolvedValueOnce(null);
    jest.spyOn(AuthRepo, 'createUser').mockResolvedValueOnce({
      id: newMockUser.id,
      email: newMockUser.email,
      username: newMockUser.username,
      name: newMockUser.name,
      role: newMockUser.role,
      isActive: newMockUser.isActive,
      isDeleted: newMockUser.isDeleted,
      isEmailVerified: newMockUser.isEmailVerified,
      onboardingCompleted: newMockUser.onboardingCompleted,
      createdAt: newMockUser.createdAt,
      updatedAt: newMockUser.updatedAt,
    });
    jest.spyOn(AuthRepo, 'createSocialAccount').mockResolvedValueOnce({} as AuthSocialAccount);
    jest.spyOn(AuthRepo, 'updateUser').mockResolvedValueOnce(newMockUser as AuthUser);

    jest.spyOn(AuthSvc, 'generateAuthResponse' as 'login').mockImplementationOnce(() =>
      Promise.resolve({
        accessToken: 'access_jwt_new',
        refreshToken: 'refresh_jwt_new',
        user: {
          id: newMockUser.id,
          email: newMockUser.email,
          username: newMockUser.username,
          name: newMockUser.name,
          role: newMockUser.role,
          avatar: undefined,
          onboardingCompleted: newMockUser.onboardingCompleted,
        },
      } as never),
    );

    const result = await AuthSvc.loginWithGoogle('new_user_token');

    expect(AuthRepo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: 'newuser@example.com',
        password: undefined,
      }),
    );
    expect(result.accessToken).toBe('access_jwt_new');
  });
});
