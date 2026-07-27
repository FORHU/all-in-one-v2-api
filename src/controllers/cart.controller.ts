import { Request, Response, NextFunction } from 'express';
import CartService from '../services/cart.service';
import { responseSuccess } from '../helpers/response.helper';

export default class CartController {
  static async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.id;
      const sessionId = req.headers['x-session-id'] as string | undefined;

      const cart = await CartService.getOrCreateCart(customerId, sessionId);
      return responseSuccess(res, 200, cart);
    } catch (error) {
      next(error);
    }
  }

  static async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const customerId = req.user?.id;
      const sessionId = req.headers['x-session-id'] as string | undefined;
      const { productVariantId, quantity = 1 } = req.body;

      const updatedCart = await CartService.addItemToCart({
        customerId,
        sessionId,
        productVariantId,
        quantity: Number(quantity),
      });

      return responseSuccess(res, 200, updatedCart, 'Item added to cart');
    } catch (error) {
      next(error);
    }
  }

  static async updateItemQuantity(req: Request, res: Response, next: NextFunction) {
    try {
      const { cartItemId } = req.params;
      const { quantity } = req.body;

      const result = await CartService.updateCartItemQuantity(cartItemId, Number(quantity));
      return responseSuccess(res, 200, result, 'Cart item updated');
    } catch (error) {
      next(error);
    }
  }

  static async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { cartItemId } = req.params;
      await CartService.removeItemFromCart(cartItemId);
      return responseSuccess(res, 200, null, 'Item removed from cart');
    } catch (error) {
      next(error);
    }
  }
}
