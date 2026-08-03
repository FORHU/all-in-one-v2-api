import SupplierRepository from '../repositories/supplier.repository';
import { Prisma } from '@prisma/client';
import { requireTenantId } from '../utils/async-context';

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
}
