import { TenantRole } from '@prisma/client';
import bcrypt from 'bcryptjs';
import MembershipRepository from './membership.repository';
import { UserRepository } from '../auth/user.repository';
import { throwResponse } from '../../utils/throw-response';
import { prisma } from '../../utils/prisma';
import logger from '../../utils/logger';

// Roles an ADMIN_MANAGER (as opposed to an OWNER, who has no ceiling) may
// assign. An OWNER or ADMIN_MANAGER membership is never a valid target for
// an ADMIN_MANAGER to grant — that would be a lateral/upward escalation.
const ADMIN_MANAGER_ASSIGNABLE_ROLES: TenantRole[] = [TenantRole.ADMIN];

// Rows an ADMIN_MANAGER can never modify or remove, regardless of the
// requested change — this also covers an ADMIN_MANAGER's own membership,
// since their own row's role is always ADMIN_MANAGER.
const PROTECTED_ROLES: TenantRole[] = [TenantRole.OWNER, TenantRole.ADMIN_MANAGER];

export default class MembershipService {
  static async listMembers(tenantId: string) {
    return MembershipRepository.listByTenant(tenantId);
  }

  static async listMyMemberships(userId: string) {
    return MembershipRepository.listByUserId(userId);
  }

  static async listAllMemberships() {
    return MembershipRepository.listAll();
  }

  static async grant(
    tenantId: string,
    actingUserId: string,
    actingRole: TenantRole,
    targetEmail: string,
    role: TenantRole,
    // When set, a missing account is created on the spot instead of 404ing —
    // the grantor is vouching for this person, same trust boundary as
    // creating a platform account via POST /users. Never touches an
    // *existing* account even if provided (that account keeps its own
    // password) — only used on the not-found path below.
    newAccount?: { name: string; password: string },
  ) {
    if (actingRole !== TenantRole.OWNER && !ADMIN_MANAGER_ASSIGNABLE_ROLES.includes(role)) {
      return throwResponse(403, 'You may only grant the ADMIN role');
    }

    let user = await UserRepository.findByEmail(targetEmail);
    if (!user) {
      if (!newAccount) return throwResponse(404, 'No account found for that email');
      user = await this.createAccountForGrant(targetEmail, newAccount);
    }

    const existing = await MembershipRepository.findByUserId(tenantId, user.id);
    if (existing) return throwResponse(409, 'User is already a member of this store');

    const membership = await MembershipRepository.create(tenantId, user.id, role);

    await this.logAction('GRANT_TENANT_ADMIN', actingUserId, membership.id, tenantId, user.id, {
      before: null,
      after: role,
    });

    return membership;
  }

  // Mirrors the username-synthesis pattern already used for auto-provisioned
  // Google-OAuth accounts (auth.service.ts's loginWithGoogle) — a random
  // 4-digit suffix on the email's local-part, not guaranteed collision-free,
  // but consistent with how this codebase already handles "nobody picked a
  // username for this account" elsewhere.
  private static async createAccountForGrant(
    email: string,
    newAccount: { name: string; password: string },
  ) {
    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    const username = `${baseUsername}_${Math.floor(1000 + Math.random() * 9000)}`;
    const passwordHash = await bcrypt.hash(newAccount.password, 10);

    return UserRepository.create({
      email,
      username,
      name: newAccount.name,
      password: passwordHash,
      isEmailVerified: true,
    });
  }

  static async updateRole(
    tenantId: string,
    actingUserId: string,
    actingRole: TenantRole,
    membershipId: string,
    newRole: TenantRole,
  ) {
    const membership = await MembershipRepository.findById(tenantId, membershipId);
    if (!membership) return throwResponse(404, 'Membership not found');

    if (actingRole !== TenantRole.OWNER) {
      if (PROTECTED_ROLES.includes(membership.role)) {
        return throwResponse(403, "You cannot modify this member's role");
      }
      if (!ADMIN_MANAGER_ASSIGNABLE_ROLES.includes(newRole)) {
        return throwResponse(403, 'You may only set the ADMIN role');
      }
    }

    if (membership.role === TenantRole.OWNER && newRole !== TenantRole.OWNER) {
      await this.assertNotLastOwner(tenantId);
    }

    const updated = await MembershipRepository.updateRole(membershipId, newRole);

    await this.logAction(
      'UPDATE_TENANT_MEMBER_ROLE',
      actingUserId,
      membershipId,
      tenantId,
      membership.userId,
      { before: membership.role, after: newRole },
    );

    return updated;
  }

  static async remove(
    tenantId: string,
    actingUserId: string,
    actingRole: TenantRole,
    membershipId: string,
  ) {
    const membership = await MembershipRepository.findById(tenantId, membershipId);
    if (!membership) return throwResponse(404, 'Membership not found');

    if (actingRole !== TenantRole.OWNER && PROTECTED_ROLES.includes(membership.role)) {
      return throwResponse(403, 'You cannot remove this member');
    }

    if (membership.role === TenantRole.OWNER) {
      await this.assertNotLastOwner(tenantId);
    }

    await MembershipRepository.remove(membershipId);

    await this.logAction(
      'REVOKE_TENANT_ADMIN',
      actingUserId,
      membershipId,
      tenantId,
      membership.userId,
      { before: membership.role, after: null },
    );

    return { message: 'Membership removed' };
  }

  private static async assertNotLastOwner(tenantId: string) {
    const ownerCount = await MembershipRepository.countByTenantAndRole(tenantId, TenantRole.OWNER);
    if (ownerCount <= 1) {
      return throwResponse(409, 'Cannot remove the last owner of this store');
    }
  }

  // Best-effort — a logging failure must never roll back or fail a grant/
  // revoke that already succeeded, so this is fire-and-forget with its own
  // try/catch rather than awaited inline in the callers above.
  private static async logAction(
    action: string,
    actingUserId: string,
    membershipId: string,
    tenantId: string,
    targetUserId: string,
    state: { before: TenantRole | null; after: TenantRole | null },
  ) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: actingUserId,
          action,
          entity: 'TenantMembership',
          entityId: membershipId,
          beforeState: state.before ? { role: state.before } : undefined,
          afterState: state.after ? { role: state.after } : undefined,
          details: { tenantId, targetUserId },
        },
      });
    } catch (error) {
      logger.error('[MembershipService] Failed to write audit log', error);
    }
  }
}
