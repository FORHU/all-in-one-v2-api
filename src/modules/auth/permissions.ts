import { UserRole, TenantRole } from '@prisma/client';

export type Permission =
  // Catalog
  | 'catalog:read'
  | 'catalog:write'
  | 'catalog:delete'
  // Orders
  | 'orders:read'
  | 'orders:write'
  | 'orders:refund'
  // Customers
  | 'customers:read'
  | 'customers:write'
  // Analytics
  | 'analytics:read'
  // Settings
  | 'tenant_settings:read'
  | 'tenant_settings:write'
  // Platform
  | 'platform:manage';

export const PLATFORM_ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    'platform:manage',
    'catalog:read',
    'catalog:write',
    'catalog:delete',
    'orders:read',
    'orders:write',
    'orders:refund',
    'customers:read',
    'customers:write',
    'analytics:read',
    'tenant_settings:read',
    'tenant_settings:write',
  ],
  [UserRole.DEVELOPER]: [
    'platform:manage',
    'catalog:read',
    'catalog:write',
    'catalog:delete',
    'orders:read',
    'orders:write',
    'orders:refund',
    'customers:read',
    'customers:write',
    'analytics:read',
    'tenant_settings:read',
    'tenant_settings:write',
  ],
  [UserRole.USER]: [],
};

export const TENANT_ROLE_PERMISSIONS: Record<TenantRole, Permission[]> = {
  [TenantRole.OWNER]: [
    'catalog:read',
    'catalog:write',
    'catalog:delete',
    'orders:read',
    'orders:write',
    'orders:refund',
    'customers:read',
    'customers:write',
    'analytics:read',
    'tenant_settings:read',
    'tenant_settings:write',
  ],
  [TenantRole.ADMIN]: [
    'catalog:read',
    'catalog:write',
    'catalog:delete',
    'orders:read',
    'orders:write',
    'orders:refund',
    'customers:read',
    'customers:write',
    'analytics:read',
    'tenant_settings:read',
    'tenant_settings:write',
  ],
  [TenantRole.MANAGER]: [
    'catalog:read',
    'catalog:write',
    'orders:read',
    'orders:write',
    'customers:read',
    'customers:write',
    'analytics:read',
    'tenant_settings:read',
  ],
  [TenantRole.EDITOR]: ['catalog:read', 'catalog:write'],
  [TenantRole.SELLER]: ['catalog:read', 'orders:read', 'orders:write'],
  [TenantRole.VIEWER]: [
    'catalog:read',
    'orders:read',
    'customers:read',
    'analytics:read',
    'tenant_settings:read',
  ],
};
