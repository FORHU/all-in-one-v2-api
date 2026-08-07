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

  /**
   * Records an inbound webhook, or recognises it as a redelivery of one we have
   * already seen. Payment gateways retry on any non-2xx response, so without this
   * a single transient failure downstream turns into the same payment being
   * applied twice.
   *
   * `claimed` tells the caller whether it owns processing for this delivery:
   *   - never seen before        -> claimed, process it
   *   - seen and SUCCESS         -> not claimed, already done
   *   - seen and PENDING         -> not claimed, another delivery is mid-flight
   *   - seen and FAILED          -> claimed, the retry is exactly what we want
   */
  static async recordWebhookEvent(
    provider: string,
    externalEventId: string,
    eventType: string,
    payload: Prisma.InputJsonValue,
  ): Promise<{ event: { id: string }; claimed: boolean }> {
    try {
      const event = await prisma.commerceWebhookEvent.create({
        data: { provider, externalEventId, eventType, payload, status: SyncStatus.PENDING },
      });
      return { event, claimed: true };
    } catch (error) {
      const isDuplicate =
        error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
      if (!isDuplicate) throw error;

      const existing = await prisma.commerceWebhookEvent.findUniqueOrThrow({
        where: { provider_externalEventId: { provider, externalEventId } },
      });

      if (existing.status !== SyncStatus.FAILED) {
        return { event: existing, claimed: false };
      }

      // Retry of a failed delivery. Re-claim it only if it is still FAILED, so
      // two simultaneous redeliveries cannot both take it.
      const reclaimed = await prisma.commerceWebhookEvent.updateMany({
        where: { id: existing.id, status: SyncStatus.FAILED },
        data: { status: SyncStatus.PENDING, errorMessage: null, payload },
      });

      return { event: existing, claimed: reclaimed.count === 1 };
    }
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
