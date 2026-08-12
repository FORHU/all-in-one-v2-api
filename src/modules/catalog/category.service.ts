import CategoryRepository from './category.repository';
import { throwResponse } from '../../utils/throw-response';
import { requireTenantId } from '../../utils/async-context';

export default class CategoryService {
  static async getRootCategories() {
    return CategoryRepository.findAllRoot(requireTenantId());
  }

  static async getCategoryBySlug(slug: string) {
    const category = await CategoryRepository.findBySlug(requireTenantId(), slug);
    if (!category) {
      return throwResponse(404, `Category '${slug}' not found`);
    }
    return category;
  }

  static async createCategory(data: {
    name: string;
    slug: string;
    description?: string;
    parentId?: string;
  }) {
    const tenantId = requireTenantId();

    const existing = await CategoryRepository.findBySlug(tenantId, data.slug);
    if (existing) {
      return throwResponse(400, `Category slug '${data.slug}' already exists`);
    }
    return CategoryRepository.create(tenantId, data);
  }

  static async updateCategory(
    id: string,
    data: { name?: string; slug?: string; description?: string; parentId?: string },
  ) {
    const tenantId = requireTenantId();

    const category = await CategoryRepository.findById(tenantId, id);
    if (!category) {
      return throwResponse(404, 'Category not found');
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
