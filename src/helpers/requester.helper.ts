import { Request } from 'express';
import { UserRole } from '@prisma/client';
import CustomerRepository from '../modules/commerce/customer.repository';
import { getTenantId } from '../utils/async-context';
import type { CartOwner } from '../modules/commerce/cart.service';
import type { OrderViewer } from '../modules/commerce/order.service';

/**
 * Resolves the signed-in user to their Customer id within the active tenant,
 * creating the Customer record on first use. Returns undefined for guests or
 * unscoped requests.
 */
export const resolveCustomerId = async (req: Request): Promise<string | undefined> => {
  if (!req.user) return undefined;

  const tenantId = getTenantId();
  if (!tenantId) return undefined;

  const customer = await CustomerRepository.findOrCreateForUser(req.user, tenantId);
  return customer.id;
};

/** Identifies the caller for cart ownership checks: customer or guest session. */
export const resolveCartOwner = async (req: Request): Promise<CartOwner> => ({
  customerId: await resolveCustomerId(req),
  sessionId: req.headers['x-session-id'] as string | undefined,
});

/** Identifies the caller for order and payment ownership checks. */
export const resolveOrderViewer = async (req: Request): Promise<OrderViewer> => ({
  customerId: await resolveCustomerId(req),
  sessionId: req.headers['x-session-id'] as string | undefined,
  isAdmin: isAdmin(req),
});

export const isAdmin = (req: Request): boolean =>
  !!req.user && (req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.DEVELOPER);
