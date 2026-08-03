import WishlistRepository from '../repositories/wishlist.repository';
import { requireTenantId } from '../utils/async-context';

export default class WishlistService {
  static async getWishlist(customerId: string) {
    const tenantId = requireTenantId();
    let wishlist = await WishlistRepository.findByCustomerId(tenantId, customerId);
    if (!wishlist) {
      wishlist = await WishlistRepository.createWishlist(tenantId, customerId);
    }
    return wishlist;
  }

  static async addItem(customerId: string, productVariantId: string) {
    const wishlist = await this.getWishlist(customerId);
    if (!wishlist) throw new Error('Could not get or create wishlist');
    return WishlistRepository.addItem(wishlist.id, productVariantId);
  }

  static async removeItem(wishlistItemId: string) {
    return WishlistRepository.removeItem(wishlistItemId);
  }
}
