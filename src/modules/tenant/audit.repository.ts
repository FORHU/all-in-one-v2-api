import { prisma } from '../../utils/prisma';

export default class AuditRepository {
  static async getAuditLogs() {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  static async getJobs() {
    return prisma.job.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // New models added for 100% coverage
  static async getJobLogs(jobId: string) {
    return prisma.jobLog.findMany({
      where: { jobId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
