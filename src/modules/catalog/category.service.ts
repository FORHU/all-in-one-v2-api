import CategoryRepository from './category.repository';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';

export default class CategoryService {
  static async getRootCategories(
    page?: number,
    limit?: number,
    search?: string,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) {
    return CategoryRepository.findAllRoot(
      requireTenantId(),
      page,
      limit,
      search,
      sortBy,
      sortOrder,
    );
  }

  static async getCategoryBySlug(slug: string) {
    const category = await CategoryRepository.findBySlug(requireTenantId(), slug);
    if (!category) {
      return throwResponse(404, `Category '${slug}' not found`);
    }
    const { _count, ...rest } = category;
    return { ...rest, productCount: _count.products };
  }

  static async createCategory(data: {
    name: string;
    slug: string;
    description?: string;
    parentId?: string | null;
  }) {
    const tenantId = requireTenantId();

    const existing = await CategoryRepository.findBySlug(tenantId, data.slug);
    if (existing) {
      return throwResponse(400, `Category slug '${data.slug}' already exists`);
    }
    if (data.parentId) {
      const parent = await CategoryRepository.findById(tenantId, data.parentId);
      if (!parent) {
        return throwResponse(400, 'Parent category not found');
      }
    }
    return CategoryRepository.create(tenantId, data);
  }

  static async updateCategory(
    id: string,
    data: { name?: string; slug?: string; description?: string; parentId?: string | null },
  ) {
    const tenantId = requireTenantId();

    const category = await CategoryRepository.findById(tenantId, id);
    if (!category) {
      return throwResponse(404, 'Category not found');
    }
    if (data.parentId) {
      if (data.parentId === id) {
        return throwResponse(400, 'A category cannot be its own parent');
      }
      const parent = await CategoryRepository.findById(tenantId, data.parentId);
      if (!parent) {
        return throwResponse(400, 'Parent category not found');
      }
    }
    return CategoryRepository.update(tenantId, id, data);
  }

  static async deleteCategory(id: string) {
    const tenantId = requireTenantId();

    const category = await CategoryRepository.findById(tenantId, id);
    if (!category) {
      return throwResponse(404, 'Category not found');
    }
    return CategoryRepository.delete(tenantId, id);
  }
}
