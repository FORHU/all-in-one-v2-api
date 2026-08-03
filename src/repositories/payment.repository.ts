import { Prisma, PaymentStatus, SyncStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';

export default class PaymentRepository {
  static async findById(id: string) {
    return prisma.commercePayment.findUnique({
      where: { id },
      include: {
        order: true,
        events: true,
        attempts: true,
      },
    });
  }

  static async findByTransactionId(gatewayTransactionId: string) {
    return prisma.commercePayment.findFirst({
      where: { gatewayTransactionId },
      include: {
        order: true,
        events: true,
        attempts: true,
      },
    });
  }

  static async createPayment(data: Prisma.CommercePaymentCreateInput) {
    return prisma.commercePayment.create({
      data,
    });
  }

  static async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    gatewayResponse?: Prisma.InputJsonValue,
    eventMessage?: string,
  ) {
    return prisma.$transaction(async (tx) => {
      const payment = await tx.commercePayment.update({
        where: { id },
        data: {
          status,
          version: { increment: 1 },
          ...(gatewayResponse ? { gatewayResponse } : {}),
        },
      });

      await tx.commercePaymentEvent.create({
        data: {
          paymentId: id,
          status,
          message: eventMessage || `Payment status changed to ${status}`,
          ...(gatewayResponse ? { data: gatewayResponse } : {}),
        },
      });

      return payment;
    });
  }

  static async recordWebhookEvent(
    provider: string,
    eventType: string,
    payload: Prisma.InputJsonValue,
  ) {
    return prisma.commerceWebhookEvent.create({
      data: {
        provider,
        eventType,
        payload,
        status: SyncStatus.PENDING,
      },
    });
  }

  static async updateWebhookStatus(id: string, status: SyncStatus, errorMessage?: string) {
    return prisma.commerceWebhookEvent.update({
      where: { id },
      data: {
        status,
        errorMessage,
        processedAt: new Date(),
      },
    });
  }

  // New models added for 100% coverage
  static async getPaymentEvents(tenantId: string, paymentId: string) {
    return prisma.commercePaymentEvent.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }

  static async getPaymentAttempts(tenantId: string, paymentId: string) {
    return prisma.commercePaymentAttempt.findMany({
      where: { paymentId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
