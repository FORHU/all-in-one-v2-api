import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Role Users...\n');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const usersToSeed = [
    // Super Admin & Developer
    {
      email: 'superadmin@marketplace.com',
      username: 'superadmin',
      name: 'Global Super Admin',
      role: UserRole.SUPER_ADMIN,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
    {
      email: 'developer@marketplace.com',
      username: 'developer',
      name: 'Lead Developer',
      role: UserRole.DEVELOPER,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },

    // 3 Admins
    {
      email: 'admin@marketplace.com',
      username: 'admin1',
      name: 'Enterprise Admin',
      role: UserRole.ADMIN,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
    {
      email: 'admin2@marketplace.com',
      username: 'admin2',
      name: 'Sarah Jenkins',
      role: UserRole.ADMIN,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
    {
      email: 'admin3@marketplace.com',
      username: 'admin3',
      name: 'Marcus Vance',
      role: UserRole.ADMIN,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },

    // Seller
    {
      email: 'seller@marketplace.com',
      username: 'seller1',
      name: 'Verified Seller',
      role: UserRole.SELLER,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },

    // 5 Customers
    {
      email: 'customer@marketplace.com',
      username: 'customer1',
      name: 'John Customer',
      firstName: 'John',
      lastName: 'Customer',
      role: UserRole.USER,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
    {
      email: 'customer2@marketplace.com',
      username: 'customer2',
      name: 'Alice Smith',
      firstName: 'Alice',
      lastName: 'Smith',
      role: UserRole.USER,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
    {
      email: 'customer3@marketplace.com',
      username: 'customer3',
      name: 'Bob Johnson',
      firstName: 'Bob',
      lastName: 'Johnson',
      role: UserRole.USER,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
    {
      email: 'customer4@marketplace.com',
      username: 'customer4',
      name: 'Emma Davis',
      firstName: 'Emma',
      lastName: 'Davis',
      role: UserRole.USER,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
    {
      email: 'customer5@marketplace.com',
      username: 'customer5',
      name: 'Michael Brown',
      firstName: 'Michael',
      lastName: 'Brown',
      role: UserRole.USER,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
  ];

  for (const user of usersToSeed) {
    const { firstName, lastName, ...userData } = user;

    const upsertedUser = await prisma.authUser.upsert({
      where: { email: userData.email },
      update: userData,
      create: userData,
    });
    process.stdout.write(`✅ Seeded user [${upsertedUser.role}]: ${upsertedUser.email}\n`);

    // If this is a regular customer user, ensure CommerceCustomer profile exists
    if (userData.role === UserRole.USER) {
      const existingCustomer = await prisma.commerceCustomer.findUnique({
        where: { userId: upsertedUser.id },
      });
      if (!existingCustomer) {
        await prisma.commerceCustomer.create({
          data: {
            userId: upsertedUser.id,
            email: upsertedUser.email,
            firstName: firstName || 'Store',
            lastName: lastName || 'Customer',
          },
        });
        process.stdout.write(`✅ Created CommerceCustomer profile for: ${upsertedUser.email}\n`);
      }
    }
  }
}

export default seedUsers;
