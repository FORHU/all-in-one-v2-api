import CategoryRepository from '../repositories/category.repository';
import { throwResponse } from '../utils/throw-response';

export default class CategoryService {
  static async getRootCategories() {
    return CategoryRepository.findAllRoot();
  }

  static async getCategoryBySlug(slug: string) {
    const category = await CategoryRepository.findBySlug(slug);
    if (!category) {
      return throwResponse(404, `Category '${slug}' not found`);
    }
    return category;
  }

  static async createCategory(data: { name: string; slug: string; description?: string; parentId?: string }) {
    const existing = await CategoryRepository.findBySlug(data.slug);
    if (existing) {
      return throwResponse(400, `Category slug '${data.slug}' already exists`);
    }
    return CategoryRepository.create(data);
  }

  static async updateCategory(id: string, data: { name?: string; slug?: string; description?: string; parentId?: string }) {
    const category = await CategoryRepository.findById(id);
    if (!category) {
      return throwResponse(404, 'Category not found');
    }
    return CategoryRepository.update(id, data);
  }

  static async deleteCategory(id: string) {
    const category = await CategoryRepository.findById(id);
    if (!category) {
      return throwResponse(404, 'Category not found');
    }
    return CategoryRepository.delete(id);
  }
}
