import SupplierRepository from './supplier.repository';
import { Prisma } from '@prisma/client';
import { requireTenantId } from '../../utils/async-context';
import { supplierRegistry } from '../../suppliers/supplier.registry';
import { throwResponse } from '../../utils/throw-response';

export default class SupplierService {
  static async createPartner(data: Prisma.SupplierPartnerCreateInput) {
    return SupplierRepository.createPartner(data);
  }

  static async getPartners() {
    return SupplierRepository.findPartners();
  }

  static async getSyncJobs(page: number, limit: number) {
    return SupplierRepository.getSyncJobs(requireTenantId(), page, limit);
  }

  static async updateCredentials(partnerId: string, apiKey: string, apiSecret?: string) {
    return SupplierRepository.upsertCredential(partnerId, apiKey, apiSecret);
  }

  static async getSyncLogs(jobId: string) {
    return SupplierRepository.getSyncLogs(jobId);
  }

  static async getSupplierCatalog(partnerId: string) {
    return SupplierRepository.getSupplierProducts(partnerId);
  }

  /**
   * Normalizes each adapter's raw result onto the canonical shape (via the
   * adapter's own normalizeSearchResult, when it implements one — see
   * SupplierAdapter's doc comment) and decorates it with `alreadyImported`/
   * `catalogProductId` so the sourcing UI can flag (and block re-importing)
   * products this tenant already has in its catalog.
   */
  static async searchSupplier(supplierId: string, query: string, page: number, limit: number) {
    const tenantId = requireTenantId();
    const adapter = supplierRegistry.get(supplierId);
    const { items: rawItems, total } = await adapter.searchProducts(query, page, limit);
    const items = rawItems.map(
      (item) => adapter.normalizeSearchResult?.(item) ?? (item as Record<string, unknown>),
    );

    const externalIds = items
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const imported = await SupplierRepository.findImportedExternalIdsForTenant(
      supplierId,
      externalIds,
      tenantId,
    );

    const decoratedItems = items.map((item) => {
      const id = item.id;
      const catalogProductId = typeof id === 'string' ? (imported.get(id) ?? null) : null;
      return { ...item, alreadyImported: catalogProductId !== null, catalogProductId };
    });

    return { items: decoratedItems, total };
  }

  static async getSupplierProduct(supplierId: string, externalId: string) {
    const tenantId = requireTenantId();
    const adapter = supplierRegistry.get(supplierId);
    const rawProduct = await adapter.getProduct(externalId);
    // Adapters return null when the supplier has nothing for this id
    // (delisted, removed, or a transient lookup failure) — surfacing that as
    // a real 404 here (rather than a 200 with `data: null`) keeps it in the
    // structured ApiError path client-side instead of failing the response
    // schema's parse with an opaque error.
    if (!rawProduct) {
      throwResponse(404, `Product '${externalId}' not found on supplier '${supplierId}'`);
    }
    const product =
      adapter.normalizeProductDetail?.(rawProduct) ?? (rawProduct as Record<string, unknown>);

    const mapping = await SupplierRepository.findImportedProductForTenant(
      supplierId,
      externalId,
      tenantId,
    );

    return {
      ...product,
      alreadyImported: mapping?.productId != null,
      catalogProductId: mapping?.productId ?? null,
    };
  }

  static async getAvailableSuppliers() {
    return supplierRegistry.getAll().map((adapter) => ({
      id: adapter.supplierId,
    }));
  }
}
