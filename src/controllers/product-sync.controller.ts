import { Request, Response } from 'express';
import { JobService } from '../services/job.service';
import { JobQueueService } from '../services/job-queue.service';
import { supplierRegistry } from '../suppliers/supplier.registry';
import logger from '../utils/logger';

export class ProductSyncController {
  /**
   * POST /api/v2/products/sync
   * Expects: { supplierId: 'cj-dropshipping', externalIds: ['123', '456'] }
   */
  static async syncProducts(req: Request, res: Response) {
    try {
      const { supplierId, externalIds } = req.body;

      if (!supplierId || typeof supplierId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'supplierId is required and must be a string.',
        });
      }

      if (!externalIds || !Array.isArray(externalIds) || externalIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'externalIds is required and must be a non-empty array of strings.',
        });
      }

      // Verify adapter exists
      try {
        supplierRegistry.get(supplierId);
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : `Supplier ${supplierId} not supported.`;
        return res.status(400).json({
          success: false,
          message,
        });
      }

      // 1. Create a tracking job in the DB
      const job = await JobService.createJob(
        'PRODUCT_SYNC',
        `Sync ${externalIds.length} products from ${supplierId}`,
        { supplierId, externalIds, total: externalIds.length, successCount: 0, failCount: 0 },
      );

      // 2. Publish to RabbitMQ
      await JobQueueService.publishProductSyncJob(job.id, supplierId, { externalIds });

      // 3. Immediately return 202 Accepted
      return res.status(202).json({
        success: true,
        message: 'Product sync job started in the background.',
        data: {
          jobId: job.id,
          status: 'PENDING',
          supplierId,
          productCount: externalIds.length,
        },
      });
    } catch (error: unknown) {
      logger.error('[ProductSyncController:syncProducts] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while starting sync job.',
      });
    }
  }
}
