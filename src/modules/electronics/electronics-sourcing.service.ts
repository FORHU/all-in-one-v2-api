import { TenantStatus } from '@prisma/client';
import { supplierRegistry } from '../../suppliers/supplier.registry';
import type { CJDropshippingAdapter } from '../../suppliers/cj-dropshipping/cj.adapter';
import { ProductImportService } from '../catalog/product-import.service';
import CategoryRepository from '../catalog/category.repository';
import SupplierRepository from '../supplier/supplier.repository';
import TenantRepository from '../tenant/tenant.repository';
import { buildPage } from '../../helpers/pagination.helper';
import { throwResponse } from '../../utils/throw-response';
import {
  CJ_SUPPLIER_ID,
  ELECTRONICS_CATEGORY_SLUGS,
  ELECTRONICS_CJ_CATEGORY_IDS,
  ELECTRONICS_CJ_SOURCES,
  ELECTRONICS_TENANT_SLUG,
  ElectronicsCategorySlug,
} from './electronics.config';

export interface ElectronicsCjSearchParams {
  categorySlug: ElectronicsCategorySlug;
  /** Free-text CJ keyword. Required for a category with no CJ category ids. */
  q?: string;
  /** One of the category's mapped CJ ids; defaults to its first. */
  cjCategoryId?: string;
  page: number;
  limit: number;
}

/** A normalized CJ listV2 item (id, nameEn, bigImage, sellPrice, categoryId, …) plus import status. */
export type ElectronicsCjSearchItem = Record<string, unknown> & {
  alreadyImported: boolean;
  catalogProductId: string | null;
};

/** searchProducts' optional `categoryId` lives on the concrete CJ adapter only. */
const cjAdapter = () => supplierRegistry.get(CJ_SUPPLIER_ID) as CJDropshippingAdapter;

/**
 * DigitFriend's CJ sourcing. Always targets the electronics tenant —
 * resolved by slug here rather than from the request, so neither the HTTP
 * routes nor the bulk import script can ever write into another vertical.
 * Imports go through the same ProductImportService path addictstyle's
 * products use, so pricing rules, variants, stock and the 6-hourly resync
 * all behave identically.
 */
export class ElectronicsSourcingService {
  static async getElectronicsTenant() {
    const tenant = await TenantRepository.findBySlug(ELECTRONICS_TENANT_SLUG);
    if (!tenant) return throwResponse(404, `Tenant '${ELECTRONICS_TENANT_SLUG}' not found`);
    if (tenant.status !== TenantStatus.ACTIVE) {
      return throwResponse(409, `Tenant '${ELECTRONICS_TENANT_SLUG}' is not active`);
    }
    return tenant;
  }

  /** Each DigitFriend category with the CJ categories/keywords it sources from. */
  static async getCategoryMap() {
    const cjCategories = await cjAdapter().getCategories();
    const byId = new Map(cjCategories.map((c) => [c.id, c]));

    return ELECTRONICS_CATEGORY_SLUGS.map((slug) => {
      const source = ELECTRONICS_CJ_SOURCES[slug];
      return {
        slug,
        cjCategories: source.cjCategoryIds.map((id) => ({
          id,
          name: byId.get(id)?.name ?? null,
          path: byId.get(id)?.path ?? null,
        })),
        keywords: source.keywords,
      };
    });
  }

  /**
   * CJ products for one DigitFriend category — filtered by a mapped CJ
   * category id when the category has any, by keyword otherwise. Each
   * result is flagged `alreadyImported` against the electronics catalog.
   */
  static async searchCj({ categorySlug, q, cjCategoryId, page, limit }: ElectronicsCjSearchParams) {
    const source = ELECTRONICS_CJ_SOURCES[categorySlug];
    const ids: string[] = source.cjCategoryIds;

    if (cjCategoryId && !ids.includes(cjCategoryId)) {
      return throwResponse(400, `CJ category '${cjCategoryId}' is not mapped to '${categorySlug}'`);
    }
    const categoryId = cjCategoryId ?? ids[0];
    const keyword = q?.trim() || (categoryId ? '' : source.keywords[0]);
    if (!categoryId && !keyword) {
      return throwResponse(400, `A search keyword is required for '${categorySlug}'`);
    }

    const tenant = await this.getElectronicsTenant();
    const adapter = cjAdapter();
    const { items: rawItems, total } = await adapter.searchProducts(
      keyword,
      page,
      limit,
      categoryId,
    );
    const items = rawItems.map((item) => adapter.normalizeSearchResult(item));

    const externalIds = items
      .map((item) => item.id)
      .filter((id): id is string => typeof id === 'string' && id.length > 0);
    const imported = await SupplierRepository.findImportedExternalIdsForTenant(
      CJ_SUPPLIER_ID,
      externalIds,
      tenant.id,
    );

    const decorated = items.map((item): ElectronicsCjSearchItem => {
      const catalogProductId = typeof item.id === 'string' ? (imported.get(item.id) ?? null) : null;
      return { ...item, alreadyImported: catalogProductId !== null, catalogProductId };
    });

    return {
      ...buildPage(decorated, total, { page, limit }),
      source: { categorySlug, cjCategoryId: categoryId ?? null, keyword: keyword || null },
    };
  }

  /**
   * Imports one CJ product into a DigitFriend category. A CJ product from
   * outside the mapped electronics categories is rejected — except for a
   * keyword-sourced category (computer-peripherals), where CJ has no
   * category to check against.
   */
  static async importFromCj(externalId: string, categorySlug: ElectronicsCategorySlug) {
    const tenant = await this.getElectronicsTenant();

    const category = await CategoryRepository.findBySlug(tenant.id, categorySlug);
    if (!category) {
      return throwResponse(404, `Category '${categorySlug}' not found for electronics`);
    }

    const detail = await cjAdapter().getProduct(externalId);
    if (!detail) {
      return throwResponse(404, `Product '${externalId}' not found on CJ Dropshipping`);
    }

    const isKeywordSourced = ELECTRONICS_CJ_SOURCES[categorySlug].cjCategoryIds.length === 0;
    if (!isKeywordSourced && !ELECTRONICS_CJ_CATEGORY_IDS.has(detail.categoryId)) {
      return throwResponse(
        422,
        `CJ product '${externalId}' (${detail.categoryName ?? detail.categoryId}) is not in an electronics category`,
      );
    }

    return ProductImportService.importProduct(
      tenant.id,
      CJ_SUPPLIER_ID,
      detail as unknown as Record<string, unknown>,
      category.id,
    );
  }
}
