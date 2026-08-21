import { Request, Response, NextFunction } from 'express';
import { JobService } from '../system/job.service';
import { JobQueueService } from '../system/job-queue.service';
import { supplierRegistry } from '../../suppliers/supplier.registry';
import { ProductSyncService } from './product-sync.service';
import { requireTenantId } from '../../utils/async-context';
import logger from '../../utils/logger';

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

  /**
   * POST /api/v2/products/resync-all
   * Re-queues every already-imported product for this tenant (optionally
   * scoped to one supplier) instead of requiring the caller to know and
   * list every externalId by hand. Scoped to the caller's tenant, unlike
   * the platform-wide scheduled resync.
   * Expects (optional): { supplierId?: 'cj-dropshipping' }
   */
  static async resyncAll(req: Request, res: Response) {
    try {
      const { supplierId } = req.body ?? {};

      if (supplierId !== undefined && typeof supplierId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'supplierId must be a string when provided.',
        });
      }

      if (supplierId) {
        try {
          supplierRegistry.get(supplierId);
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : `Supplier ${supplierId} not supported.`;
          return res.status(400).json({ success: false, message });
        }
      }

      const result = await ProductSyncService.resyncAll({
        supplierName: supplierId,
        tenantId: requireTenantId(),
      });

      return res.status(202).json({
        success: true,
        message: 'Resync jobs started in the background.',
        data: result,
      });
    } catch (error: unknown) {
      logger.error('[ProductSyncController:resyncAll] Error:', error);
      return res.status(500).json({
        success: false,
        message: 'Internal server error while starting resync jobs.',
      });
    }
  }

  /**
   * POST /api/v2/products/:id/resync
   * Synchronous per-product refresh — no worker/queue involved, so errors
   * (supplier unreachable, no linked supplier, etc.) surface immediately
   * instead of failing silently in the background.
   */
  static async resyncOne(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await ProductSyncService.resyncOne(requireTenantId(), req.params.id);
      return res.status(200).json({
        success: true,
        message: `Refreshed "${product.title}" from its supplier.`,
        data: product,
      });
    } catch (error) {
      next(error);
    }
  }
}
