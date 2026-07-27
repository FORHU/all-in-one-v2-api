import { Prisma, PaymentStatus, SyncStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class PaymentRepository {
  static async findById(id: string) {
    return prisma.payment.findUnique({
      where: { id },
      include: {
        order: true,
      },
    });
  }

  static async findByTransactionId(transactionId: string) {
    return prisma.payment.findUnique({
      where: { transactionId },
      include: {
        order: true,
      },
    });
  }

  static async createPayment(data: Prisma.PaymentCreateInput) {
    return prisma.payment.create({
      data,
    });
  }

  static async updatePaymentStatus(id: string, status: PaymentStatus, rawPayload?: Prisma.InputJsonValue) {
    return prisma.payment.update({
      where: { id },
      data: {
        status,
        ...(rawPayload ? { rawPayload } : {}),
      },
    });
  }

  static async recordWebhookEvent(provider: string, eventType: string, payload: Prisma.InputJsonValue) {
    return prisma.webhookEvent.create({
      data: {
        provider,
        eventType,
        payload,
        status: SyncStatus.PENDING,
      },
    });
  }

  static async updateWebhookStatus(id: string, status: SyncStatus, errorMessage?: string) {
    return prisma.webhookEvent.update({
      where: { id },
      data: {
        status,
        errorMessage,
        processedAt: new Date(),
      },
    });
  }
}
