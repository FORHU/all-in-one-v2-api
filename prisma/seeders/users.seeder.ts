import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../../src/utils/password.util';

/**
 * Seeds initial users for all roles (SUPER_ADMIN, ADMIN, DEVELOPER, USER),
 * automatically creating a mandatory Customer profile for shopper users.
 */
export async function seedUsers(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Role Users...\n');

  const users = [
    {
      email: 'superadmin@marketplace.com',
      username: 'superadmin',
      name: 'Platform Super Admin',
      role: UserRole.SUPER_ADMIN,
      password: 'Password123!',
      isEmailVerified: true,
    },
    {
      email: 'admin@marketplace.com',
      username: 'merchantadmin',
      name: 'Storefront Admin',
      role: UserRole.ADMIN,
      password: 'Password123!',
      isEmailVerified: true,
    },
    {
      email: 'developer@marketplace.com',
      username: 'developer',
      name: 'Platform Developer',
      role: UserRole.DEVELOPER,
      password: 'Password123!',
      isEmailVerified: true,
    },
    {
      email: 'customer@marketplace.com',
      username: 'shopper1',
      name: 'Demo Customer',
      role: UserRole.USER,
      password: 'Password123!',
      isEmailVerified: true,
      createCustomerProfile: true,
    },
  ];

  for (const userData of users) {
    const { password, createCustomerProfile, ...rest } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: rest.email },
    });

    if (!existingUser) {
      const hashedPassword = await hashPassword(password);

      const createdUser = await prisma.user.create({
        data: {
          ...rest,
          password: hashedPassword,
        },
      });

      // If user is a shopper, create their 1-to-1 Customer profile
      if (createCustomerProfile) {
        await prisma.customer.create({
          data: {
            userId: createdUser.id,
            email: createdUser.email,
            firstName: 'Demo',
            lastName: 'Customer',
          },
        });
        process.stdout.write(`✅ Created Customer Profile for: ${rest.email}\n`);
      }

      process.stdout.write(`✅ Created user [${rest.role}]: ${rest.email}\n`);
    } else {
      process.stdout.write(`ℹ️  User already exists: ${rest.email}\n`);
    }
  }
}
