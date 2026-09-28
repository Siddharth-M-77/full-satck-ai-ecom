import { Router } from 'express';
import { CartController } from './cart.controller.js';
import { authenticate, optionalAuthenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Cart routes (support both guests and authenticated users)
router.get('/', optionalAuthenticate, CartController.getCart);
router.post('/items', optionalAuthenticate, CartController.addItem);
router.patch('/items/:sku', optionalAuthenticate, CartController.updateQuantity);
router.delete('/items/:sku', optionalAuthenticate, CartController.removeItem);
router.post('/merge', authenticate, CartController.mergeCart);
router.post('/coupon', optionalAuthenticate, CartController.applyCoupon);
router.delete('/coupon', optionalAuthenticate, CartController.removeCoupon);

// Wishlist routes (authenticated users only)
router.get('/wishlist', authenticate, CartController.getWishlist);
router.post('/wishlist/:productId', authenticate, CartController.addToWishlist);
router.delete('/wishlist/:productId', authenticate, CartController.removeFromWishlist);

export const cartRouter = router;
