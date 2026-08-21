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
   * Decorates each raw result with `alreadyImported`/`catalogProductId` so
   * the sourcing UI can flag (and block re-importing) products this tenant
   * already has in its catalog. Search results from every adapter carry the
   * external id under `id` — see product-sourcing.contract.ts's comment on
   * SupplierSearchResultSchema for why that's safe to rely on here.
   */
  static async searchSupplier(supplierId: string, query: string, page: number, limit: number) {
    const tenantId = requireTenantId();
    const adapter = supplierRegistry.get(supplierId);
    const { items, total } = await adapter.searchProducts(query, page, limit);

    const externalIds = items
      .map((item) => (item as Record<string, unknown>).id)
      .filter((id): id is string => typeof id === 'string');
    const imported = await SupplierRepository.findImportedExternalIdsForTenant(
      supplierId,
      externalIds,
      tenantId,
    );

    const decoratedItems = items.map((item) => {
      const id = (item as Record<string, unknown>).id;
      const catalogProductId = typeof id === 'string' ? (imported.get(id) ?? null) : null;
      return { ...(item as object), alreadyImported: catalogProductId !== null, catalogProductId };
    });

    return { items: decoratedItems, total };
  }

  static async getSupplierProduct(supplierId: string, externalId: string) {
    const tenantId = requireTenantId();
    const adapter = supplierRegistry.get(supplierId);
    const product = await adapter.getProduct(externalId);
    // Adapters return null when the supplier has nothing for this id
    // (delisted, removed, or a transient lookup failure) — surfacing that as
    // a real 404 here (rather than a 200 with `data: null`) keeps it in the
    // structured ApiError path client-side instead of failing the response
    // schema's parse with an opaque error.
    if (!product) {
      throwResponse(404, `Product '${externalId}' not found on supplier '${supplierId}'`);
    }

    const mapping = await SupplierRepository.findImportedProductForTenant(
      supplierId,
      externalId,
      tenantId,
    );

    return {
      ...(product as object),
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
