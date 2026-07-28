import { PrismaClient, UserRole } from '@prisma/client';
import { hashPassword } from '../../src/utils/password.util';

/**
 * Seeds initial users, hashed with bcrypt via the same helper the auth service
 * uses.
 */
export async function seedUsers(prisma: PrismaClient) {
  process.stdout.write('🌱 Seeding Users...\n');

  const users = [
    {
      email: 'admin@example.com',
      username: 'admin',
      name: 'System Admin',
      role: UserRole.SUPER_ADMIN,
      password: 'Password123!',
      isEmailVerified: true,
    },
    {
      email: 'dev@example.com',
      username: 'developer',
      name: 'Lead Developer',
      role: UserRole.DEVELOPER,
      password: 'Password123!',
      isEmailVerified: true,
    },
    {
      email: 'user@example.com',
      username: 'user1',
      name: 'Regular User',
      role: UserRole.USER,
      password: 'Password123!',
      isEmailVerified: true,
    },
  ];

  for (const userData of users) {
    const { password, ...rest } = userData;

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: rest.email },
    });

    if (!existingUser) {
      const hashedPassword = await hashPassword(password);

      await prisma.user.create({
        data: {
          ...rest,
          password: hashedPassword,
        },
      });
      process.stdout.write(`✅ Created user: ${rest.email}\n`);
    } else {
      process.stdout.write(`ℹ️  User already exists: ${rest.email}\n`);
    }
  }
}
