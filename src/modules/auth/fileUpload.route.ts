import express, { Request, Response, NextFunction } from 'express';
import { upload } from '../../middleware/upload.middleware';
import { authenticate, requirePermission } from '../../middleware/auth.middleware';
import { restoreTenantContext } from '../../middleware/tenant.middleware';
import { requireTenantId, requireTenantSlug } from '../../utils/async-context';
import { uploadToS3 } from '../../utils/s3.util';
import { responseSuccess } from '../../helpers/response.helper';
import { throwResponse } from '../../utils/throw-response';
import { prisma } from '../../utils/prisma';
import logger from '../../utils/logger';

const router = express.Router();

/**
 * Distinct supplier partner names (e.g. "cj-dropshipping") behind the given
 * catalog product ids, in no particular order. A product with no supplier
 * mapping (manually added, not sourced) is silently skipped rather than
 * failing the upload — the supplier segment is decoration, not a required
 * fact about every product in a collection.
 */
async function resolveSupplierNames(productIds: string[]): Promise<string[]> {
  if (productIds.length === 0) return [];

  const rows = await prisma.supplierProduct.findMany({
    where: { productId: { in: productIds } },
    select: { supplier: { select: { name: true } } },
  });
  return [...new Set(rows.map((r) => r.supplier.name))];
}

router.post(
  '/upload',
  authenticate,
  requirePermission('catalog:write'),
  upload.single('file'),
  // multer's multipart parsing sits between resolveTenant and this handler
  // and can silently drop AsyncLocalStorage continuity — re-enter it from
  // the snapshot resolveTenant left on `req` before requireTenantId() below
  // runs. See restoreTenantContext's doc comment.
  restoreTenantContext,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return throwResponse(400, 'No file uploaded');

      const tenantId = requireTenantId();
      const tenantSlug = requireTenantSlug();
      // Caller-provided grouping (e.g. "collections") — falls back to a
      // generic bucket folder when omitted.
      const baseFolder =
        typeof req.body.folder === 'string' && req.body.folder.trim()
          ? req.body.folder.trim()
          : 'uploads';
      const productIds =
        typeof req.body.productIds === 'string' && req.body.productIds.trim()
          ? req.body.productIds.split(',').filter(Boolean)
          : [];

      const supplierNames = await resolveSupplierNames(productIds);
      const folderSegments = [baseFolder, tenantSlug, tenantId];
      if (supplierNames.length) folderSegments.push(supplierNames.join('-'));
      const folder = folderSegments.join('/');

      const url = await uploadToS3({
        buffer: req.file.buffer,
        mimetype: req.file.mimetype,
        originalName: req.file.originalname,
        folder,
        filenamePrefix: typeof req.body.slug === 'string' ? req.body.slug : undefined,
      });

      logger.info(`File uploaded to S3: ${url}`);

      return responseSuccess(
        res,
        201,
        {
          url,
          name: req.file.originalname,
          size: req.file.size,
          mimetype: req.file.mimetype,
        },
        'File uploaded successfully',
      );
    } catch (error) {
      next(error);
    }
  },
);

export default router;
