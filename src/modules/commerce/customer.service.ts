import CustomerRepository from './customer.repository';
import { requireTenantId } from '../../utils/async-context';

export class CustomerService {
  static async listCustomers(
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
    isActive?: boolean,
  ) {
    const result = await CustomerRepository.findAll(
      requireTenantId(),
      page,
      limit,
      search,
      sortBy,
      sortOrder,
      isActive,
    );
    return {
      ...result,
      items: result.items.map((u) => {
        // Prefer the commerce-tier name (set at checkout) over the auth-tier
        // name/username, since it's more likely to be the customer's real name.
        const commerceName =
          u.customer && (u.customer.firstName || u.customer.lastName)
            ? [u.customer.firstName, u.customer.lastName].filter(Boolean).join(' ')
            : undefined;

        return {
          id: u.id,
          name: commerceName ?? u.name ?? u.username,
          email: u.email,
          phone: u.customer?.phone ?? null,
          orderCount: u.customer?._count.orders ?? 0,
          isActive: u.isActive,
          isEmailVerified: u.isEmailVerified,
          lastLoginAt: u.lastLoginAt,
          createdAt: u.createdAt,
        };
      }),
    };
  }
}

export default CustomerService;
