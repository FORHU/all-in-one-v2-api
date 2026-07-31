import SizeGuideRepository from '../repositories/size-guide.repository';
import { throwResponse } from '../utils/throw-response';
import { Prisma } from '@prisma/client';

export default class SizeGuideService {
  static async getGuideById(id: string) {
    const guide = await SizeGuideRepository.findById(id);
    if (!guide) return throwResponse(404, 'Size guide not found');
    return guide;
  }

  static async getGuidesByProduct(productId: string) {
    return SizeGuideRepository.findByProductId(productId);
  }

  static async createGuide(data: {
    productId: string;
    label: string;
    description?: string;
    unit?: string;
    entries?: Omit<Prisma.CatalogSizeEntryCreateWithoutGuideInput, 'id'>[];
  }) {
    return SizeGuideRepository.create(data);
  }

  static async updateGuide(id: string, data: Prisma.CatalogSizeGuideUpdateInput) {
    const existing = await SizeGuideRepository.findById(id);
    if (!existing) return throwResponse(404, 'Size guide not found');
    return SizeGuideRepository.update(id, data);
  }

  static async deleteGuide(id: string) {
    const existing = await SizeGuideRepository.findById(id);
    if (!existing) return throwResponse(404, 'Size guide not found');
    return SizeGuideRepository.delete(id);
  }

  // ─── Entry Operations ───────────────────────────────────────────────────────

  static async addEntry(guideId: string, data: Omit<Prisma.CatalogSizeEntryCreateInput, 'guide'>) {
    const guide = await SizeGuideRepository.findById(guideId);
    if (!guide) return throwResponse(404, 'Size guide not found');
    return SizeGuideRepository.addEntry(guideId, data);
  }

  static async updateEntry(entryId: string, data: Prisma.CatalogSizeEntryUpdateInput) {
    return SizeGuideRepository.updateEntry(entryId, data);
  }

  static async deleteEntry(entryId: string) {
    return SizeGuideRepository.deleteEntry(entryId);
  }

  static async linkVariant(variantId: string, sizeEntryId: string | null) {
    return SizeGuideRepository.linkVariantToEntry(variantId, sizeEntryId);
  }
}
