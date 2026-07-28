import { Request } from 'express';
import CustomerRepository from '../repositories/customer.repository';
import { ADMIN_ROLES } from '../middleware/auth.middleware';
import type { CartOwner } from '../services/cart.service';
import type { OrderViewer } from '../services/order.service';

/**
 * Resolves the signed-in user to their Customer id, creating the Customer
 * record on first use. Returns undefined for guests.
 *
 * Commerce tables (Cart, Order) are keyed by Customer, while auth deals in
 * User — passing `req.user.id` straight into a `customerId` field is always a
 * bug, so route handlers go through here instead.
 */
export const resolveCustomerId = async (req: Request): Promise<string | undefined> => {
  if (!req.user) return undefined;

  const customer = await CustomerRepository.findOrCreateForUser(req.user);
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

export const isAdmin = (req: Request): boolean => !!req.user && ADMIN_ROLES.includes(req.user.role);
