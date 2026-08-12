import InventoryRepository from './inventory.repository';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';
import { Prisma } from '@prisma/client';

export default class InventoryService {
  static async getLocations() {
    return InventoryRepository.findAllLocations(requireTenantId());
  }

  static async getLocationById(id: string) {
    const location = await InventoryRepository.findLocationById(requireTenantId(), id);
    if (!location) return throwResponse(404, 'Inventory location not found');
    return location;
  }

  static async createLocation(data: {
    name: string;
    code: string;
    type: string;
    isPrimary?: boolean;
    address?: Prisma.InputJsonValue;
  }) {
    return InventoryRepository.createLocation(requireTenantId(), data);
  }

  static async updateLocation(id: string, data: Prisma.InventoryLocationUpdateInput) {
    const tenantId = requireTenantId();
    const existing = await InventoryRepository.findLocationById(tenantId, id);
    if (!existing) return throwResponse(404, 'Inventory location not found');
    return InventoryRepository.updateLocation(id, data);
  }

  static async getVariantStockSummary(variantId: string) {
    return InventoryRepository.getStockSummaryByVariant(variantId);
  }

  static async setStock(
    variantId: string,
    locationId: string,
    onHand: number,
    reorderPoint?: number,
  ) {
    return InventoryRepository.setStock(
      requireTenantId(),
      variantId,
      locationId,
      onHand,
      reorderPoint,
    );
  }

  static async reserveStock(variantId: string, locationId: string, quantity: number) {
    return InventoryRepository.reserveStock(variantId, locationId, quantity);
  }

  static async getTransactions(locationId: string, variantId?: string) {
    return InventoryRepository.getTransactions(requireTenantId(), locationId, variantId);
  }

  static async releaseReservation(variantId: string, locationId: string, quantity: number) {
    return InventoryRepository.releaseReservation(variantId, locationId, quantity);
  }
}
