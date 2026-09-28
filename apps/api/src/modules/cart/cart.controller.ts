import { Request, Response, NextFunction } from 'express';
import { CartService } from './cart.service.js';
import { WishlistService } from './wishlist.service.js';

function getSessionIdentifiers(req: Request) {
  const userId = req.user?._id?.toString();
  const sessionId = (req.headers['x-session-id'] as string) || req.cookies?.shopsense_session_id;
  return { userId, sessionId };
}

export class CartController {
  static async getCart(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, sessionId } = getSessionIdentifiers(req);
      const cart = await CartService.getCart(userId, sessionId);
      res.status(200).json({ success: true, data: cart });
    } catch (err) {
      next(err);
    }
  }

  static async addItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, sessionId } = getSessionIdentifiers(req);
      const cart = await CartService.addItem(userId, sessionId, req.body);
      res.status(200).json({ success: true, message: 'Item added to cart', data: cart });
    } catch (err) {
      next(err);
    }
  }

  static async updateQuantity(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, sessionId } = getSessionIdentifiers(req);
      const sku = req.params.sku as string;
      const { quantity } = req.body;
      const cart = await CartService.updateQuantity(userId, sessionId, sku, Number(quantity));
      res.status(200).json({ success: true, message: 'Quantity updated', data: cart });
    } catch (err) {
      next(err);
    }
  }

  static async removeItem(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, sessionId } = getSessionIdentifiers(req);
      const sku = req.params.sku as string;
      const cart = await CartService.removeItem(userId, sessionId, sku);
      res.status(200).json({ success: true, message: 'Item removed from cart', data: cart });
    } catch (err) {
      next(err);
    }
  }

  static async mergeCart(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!._id.toString();
      const { guestSessionId } = req.body;
      const cart = await CartService.mergeCart(userId, guestSessionId);
      res.status(200).json({ success: true, message: 'Cart merged successfully', data: cart });
    } catch (err) {
      next(err);
    }
  }

  static async applyCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, sessionId } = getSessionIdentifiers(req);
      const cart = await CartService.applyCoupon(userId, sessionId, req.body?.code);
      res.status(200).json({ success: true, message: `Coupon ${cart.appliedCoupon?.code} applied`, data: cart });
    } catch (err) {
      next(err);
    }
  }

  static async removeCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const { userId, sessionId } = getSessionIdentifiers(req);
      const cart = await CartService.removeCoupon(userId, sessionId);
      res.status(200).json({ success: true, message: 'Coupon removed', data: cart });
    } catch (err) {
      next(err);
    }
  }

  // Wishlist
  static async getWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!._id.toString();
      const wishlist = await WishlistService.getWishlist(userId);
      res.status(200).json({ success: true, data: wishlist });
    } catch (err) {
      next(err);
    }
  }

  static async addToWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!._id.toString();
      const productId = req.params.productId as string;
      const wishlist = await WishlistService.addProduct(userId, productId);
      res.status(200).json({ success: true, message: 'Saved to wishlist', data: wishlist });
    } catch (err) {
      next(err);
    }
  }

  static async removeFromWishlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!._id.toString();
      const productId = req.params.productId as string;
      const wishlist = await WishlistService.removeProduct(userId, productId);
      res.status(200).json({ success: true, message: 'Removed from wishlist', data: wishlist });
    } catch (err) {
      next(err);
    }
  }
}
