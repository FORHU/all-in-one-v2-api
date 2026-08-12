import AttributeRepository from './attribute.repository';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';
import { AttributeType, Prisma } from '@prisma/client';

export default class AttributeService {
  static async getAttributes() {
    return AttributeRepository.findAll(requireTenantId());
  }

  static async getAttributeById(id: string) {
    const attribute = await AttributeRepository.findById(requireTenantId(), id);
    if (!attribute) return throwResponse(404, 'Catalog attribute not found');
    return attribute;
  }

  static async createAttribute(data: {
    name: string;
    code: string;
    type?: AttributeType;
    isFilterable?: boolean;
    isSearchable?: boolean;
    values?: { value: string; label: string; swatchColor?: string; position?: number }[];
  }) {
    const tenantId = requireTenantId();
    const existing = await AttributeRepository.findByCode(tenantId, data.code);
    if (existing) return throwResponse(409, `Attribute code '${data.code}' already exists`);
    return AttributeRepository.create(tenantId, data);
  }

  static async updateAttribute(id: string, data: Prisma.CatalogAttributeUpdateInput) {
    const tenantId = requireTenantId();
    const existing = await AttributeRepository.findById(tenantId, id);
    if (!existing) return throwResponse(404, 'Catalog attribute not found');
    return AttributeRepository.update(tenantId, id, data);
  }

  static async deleteAttribute(id: string) {
    const tenantId = requireTenantId();
    const existing = await AttributeRepository.findById(tenantId, id);
    if (!existing) return throwResponse(404, 'Catalog attribute not found');
    return AttributeRepository.delete(tenantId, id);
  }

  static async addValue(
    attributeId: string,
    data: { value: string; label: string; swatchColor?: string; position?: number },
  ) {
    const tenantId = requireTenantId();
    const attribute = await AttributeRepository.findById(tenantId, attributeId);
    if (!attribute) return throwResponse(404, 'Catalog attribute not found');
    return AttributeRepository.addValue(attributeId, data);
  }

  static async deleteValue(valueId: string) {
    return AttributeRepository.deleteValue(valueId);
  }

  static async setVariantAttributes(variantId: string, valueIds: string[]) {
    return AttributeRepository.setVariantAttributes(variantId, valueIds);
  }
}
