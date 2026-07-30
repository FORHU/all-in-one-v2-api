import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { UserRepository } from '../repositories/user.repository';
import { throwResponse } from '../utils/throw-response';

export class UserService {
  static async getUserProfile(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user) return throwResponse(404, 'User not found');
    const { password, ...rest } = user;
    return rest;
  }

  static async getUser(userId: string) {
    return this.getUserProfile(userId);
  }

  static async createUser(data: Prisma.AuthUserCreateInput) {
    const existingEmail = await UserRepository.findByEmail(data.email);
    if (existingEmail) return throwResponse(409, 'Email is already registered');

    const existingUsername = await UserRepository.findByUsername(data.username);
    if (existingUsername) return throwResponse(409, 'Username is already taken');

    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const user = await UserRepository.create(data);
    const { password, ...rest } = user;
    return rest;
  }

  static async updateUser(userId: string, data: Prisma.AuthUserUpdateInput) {
    const user = await UserRepository.findById(userId);
    if (!user) return throwResponse(404, 'User not found');

    if (data.password && typeof data.password === 'string') {
      data.password = await bcrypt.hash(data.password, 10);
    }

    const updated = await UserRepository.update(userId, data);
    const { password, ...rest } = updated;
    return rest;
  }

  static async deleteUser(userId: string) {
    const user = await UserRepository.findById(userId);
    if (!user) return throwResponse(404, 'User not found');

    await UserRepository.softDelete(userId);
    return { message: 'User deleted successfully' };
  }

  static async listUsers(page?: number, limit?: number) {
    return UserRepository.findAll(page, limit);
  }
}

export default UserService;
