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
        const cust = u.customers[0];
        const commerceName =
          cust && (cust.firstName || cust.lastName)
            ? [cust.firstName, cust.lastName].filter(Boolean).join(' ')
            : undefined;

        return {
          id: u.id,
          name: commerceName ?? u.name ?? u.username,
          email: u.email,
          phone: cust?.phone ?? null,
          orderCount: cust?._count.orders ?? 0,
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
