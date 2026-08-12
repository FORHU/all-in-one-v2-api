import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
import { authorize } from '../../src/middleware/auth.middleware';

const mockRes = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const reqWithRole = (role?: UserRole) =>
  ({ user: role ? { role } : undefined }) as unknown as Request;

const PLATFORM_ADMIN_ROLES = [UserRole.SUPER_ADMIN, UserRole.DEVELOPER];

describe('authorize', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('allows a user whose role is listed', () => {
    const res = mockRes();
    authorize(UserRole.SUPER_ADMIN)(reqWithRole(UserRole.SUPER_ADMIN), res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('rejects a user whose role is not listed with 403', () => {
    const res = mockRes();
    authorize(UserRole.SUPER_ADMIN)(reqWithRole(UserRole.USER), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('rejects an unauthenticated request with 401', () => {
    const res = mockRes();
    authorize(UserRole.SUPER_ADMIN)(reqWithRole(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts any platform admin role', () => {
    for (const role of PLATFORM_ADMIN_ROLES) {
      const res = mockRes();
      const spy = jest.fn();
      authorize(...PLATFORM_ADMIN_ROLES)(reqWithRole(role), res, spy);
      expect(spy).toHaveBeenCalled();
    }
  });

  it('does not treat a plain USER as an admin', () => {
    const res = mockRes();
    authorize(...PLATFORM_ADMIN_ROLES)(reqWithRole(UserRole.USER), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
