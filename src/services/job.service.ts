import { JobStatus, Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma';
import logger from '../utils/logger';

export class JobService {
  /**
   * Create a new job record
   */
  static async createJob(type: string, content: string, payload: any) {
    try {
      const job = await prisma.job.create({
        data: {
          type,
          content,
          status: 'PENDING',
          payload: payload || {},
        },
      });
      return job;
    } catch (error) {
      logger.error('[JobService:createJob] Error:', error);
      throw error;
    }
  }

  /**
   * Update job status and potentially error/payload
   */
  static async updateJobStatus(jobId: string, status: JobStatus, error?: any) {
    try {
      if (!jobId) return null;

      const updateData: Prisma.JobUpdateInput = { status };

      if (status === 'PROCESSING') {
        updateData.startedAt = new Date();
      } else if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(status)) {
        updateData.completedAt = new Date();
      }

      if (error) {
        const message = error instanceof Error ? error.message : String(error);
        const currentJob = await prisma.job.findUnique({ where: { id: jobId } });
        const currentPayload = (currentJob?.payload as any) || {};
        updateData.payload = {
          ...currentPayload,
          error: message,
          stack: error instanceof Error ? error.stack : undefined,
        };
        updateData.error = message;
      }

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return null;

      const terminalStates: JobStatus[] = ['COMPLETED', 'FAILED', 'CANCELLED'];
      if (terminalStates.includes(job.status)) {
        return job;
      }

      return await prisma.job.update({
        where: { id: jobId },
        data: updateData,
      });
    } catch (error) {
      logger.error('[JobService:updateJobStatus] Error:', error);
      return null;
    }
  }

  /**
   * Update job payload data (like progress tracking)
   */
  static async updateJobPayload(jobId: string, data: any) {
    try {
      if (!jobId) return null;

      const job = await prisma.job.findUnique({ where: { id: jobId } });
      if (!job) return null;

      const currentPayload = (job.payload as any) || {};
      return await prisma.job.update({
        where: { id: jobId },
        data: {
          payload: {
            ...currentPayload,
            ...data,
          },
        },
      });
    } catch (error) {
      logger.error('[JobService:updateJobPayload] Error:', error);
      return null;
    }
  }
}
