import SupplierRepository from './supplier.repository';
import { Prisma } from '@prisma/client';
import { requireTenantId } from '../../utils/async-context';
import { supplierRegistry } from '../../suppliers/supplier.registry';

export default class SupplierService {
  static async createPartner(data: Prisma.SupplierPartnerCreateInput) {
    return SupplierRepository.createPartner(data);
  }

  static async getPartners() {
    return SupplierRepository.findPartners();
  }

  static async getSyncJobs() {
    return SupplierRepository.getSyncJobs(requireTenantId());
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

  static async searchSupplier(supplierId: string, query: string, page: number, limit: number) {
    const adapter = supplierRegistry.get(supplierId);
    return adapter.searchProducts(query, page, limit);
  }

  static async getSupplierProduct(supplierId: string, externalId: string) {
    const adapter = supplierRegistry.get(supplierId);
    return adapter.getProduct(externalId);
  }

  static async getAvailableSuppliers() {
    return supplierRegistry.getAll().map((adapter) => ({
      id: adapter.supplierId,
    }));
  }
}
