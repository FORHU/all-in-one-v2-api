import AnalyticsRepository from '../repositories/analytics.repository';
import { requireTenantId } from '../utils/async-context';

export default class AnalyticsService {
  static async getDailySales(startDateStr: string, endDateStr: string) {
    const startDate = new Date(startDateStr);
    const endDate = new Date(endDateStr);
    return AnalyticsRepository.getDailySales(requireTenantId(), startDate, endDate);
  }

  static async getTopProducts() {
    return AnalyticsRepository.getProductSales(requireTenantId());
  }

  static async getCategorySales() {
    return AnalyticsRepository.getCategorySales(requireTenantId());
  }

  static async getSupplierAnalytics() {
    return AnalyticsRepository.getSupplierAnalytics(requireTenantId());
  }

  static async getCustomerAnalytics() {
    return AnalyticsRepository.getCustomerAnalytics(requireTenantId());
  }
}
