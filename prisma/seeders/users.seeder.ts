import { PrismaClient, UserRole } from '@prisma/client';
import bcrypt from 'bcryptjs';

export async function seedUsers(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Role Users...\n');

  const passwordHash = await bcrypt.hash('Password123!', 10);

  const usersToSeed = [
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
      email: 'admin@marketplace.com',
      username: 'admin',
      name: 'Enterprise Admin',
      role: UserRole.ADMIN,
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
    {
      email: 'customer@marketplace.com',
      username: 'customer1',
      name: 'John Customer',
      role: UserRole.USER,
      password: passwordHash,
      onboardingCompleted: true,
      isEmailVerified: true,
    },
  ];

  for (const user of usersToSeed) {
    const existingUser = await prisma.authUser.findUnique({
      where: { email: user.email },
    });

    if (existingUser) {
      process.stdout.write(`ℹ️  User already exists: ${user.email}\n`);
    } else {
      const createdUser = await prisma.authUser.create({
        data: user,
      });
      process.stdout.write(`✅ Created user [${user.role}]: ${user.email}\n`);

      // If this is a regular customer user, seed Customer record
      if (user.role === UserRole.USER) {
        await prisma.commerceCustomer.create({
          data: {
            userId: createdUser.id,
            email: createdUser.email,
            firstName: 'John',
            lastName: 'Customer',
          },
        });
        process.stdout.write(`✅ Created Customer Profile for: ${user.email}\n`);
      }
    }
  }
}

export default seedUsers;
