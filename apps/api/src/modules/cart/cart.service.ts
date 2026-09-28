import mongoose from 'mongoose';
import { Cart, ICart } from './cart.model.js';
import { Product } from '../catalog/product.model.js';
import { AppError } from '../../utils/app-error.js';
import { CouponService } from '../coupons/coupon.service.js';
import { computePricing } from '../orders/pricing.js';

export class CartService {
  private static async findCart(userId?: string, sessionId?: string): Promise<ICart | null> {
    if (userId) {
      return Cart.findOne({ userId: new mongoose.Types.ObjectId(userId) });
    }
    if (sessionId) {
      return Cart.findOne({ sessionId });
    }
    return null;
  }

  static async getCart(userId?: string, sessionId?: string) {
    let cart = await this.findCart(userId, sessionId);

    if (!cart) {
      if (userId) {
        cart = await Cart.create({
          userId: new mongoose.Types.ObjectId(userId),
          items: [],
        });
      } else if (sessionId) {
        cart = await Cart.create({
          sessionId,
          items: [],
        });
      } else {
        throw AppError.badRequest('Session ID or user authentication required to view cart');
      }
    }

    // Populate product details & fresh live prices
    const populatedItems: any[] = [];
    let itemsTotal = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.productId).lean();
      if (!product) continue;

      const variant = product.variants.find((v) => v.sku === item.sku);
      if (!variant) continue;

      const livePrice = variant.price;
      const subtotal = livePrice * item.quantity;
      itemsTotal += subtotal;

      populatedItems.push({
        _id: item._id,
        productId: product._id,
        title: product.title,
        slug: product.slug,
        sku: item.sku,
        attributes: variant.attributes,
        price: livePrice,
        compareAtPrice: variant.compareAtPrice,
        quantity: item.quantity,
        subtotal,
        image: variant.images?.[0]?.url || '',
        stock: variant.stock,
      });
    }

    // Re-check the coupon on every read: the basket may have dropped below the minimum,
    // or the coupon may have expired since it was applied.
    let discountTotal = 0;
    let couponError: string | undefined;
    const couponCode = cart.appliedCoupon?.code;
    if (couponCode) {
      try {
        discountTotal = (await CouponService.evaluate(couponCode, itemsTotal, userId)).discountAmount;
      } catch (err) {
        couponError = err instanceof Error ? err.message : 'Coupon can no longer be applied';
      }
    }

    return {
      _id: cart._id,
      userId: cart.userId,
      sessionId: cart.sessionId,
      items: populatedItems,
      appliedCoupon: couponCode ? { code: couponCode, discountAmount: discountTotal } : null,
      couponError,
      pricing: computePricing(itemsTotal, discountTotal),
    };
  }

  static async applyCoupon(userId?: string, sessionId?: string, code?: string) {
    if (!code || typeof code !== 'string') throw AppError.badRequest('Enter a coupon code');
    const cart = await this.findCart(userId, sessionId);
    if (!cart || cart.items.length === 0) throw AppError.badRequest('Add something to your cart before applying a coupon');

    const current = await this.getCart(userId, sessionId);
    const { coupon, discountAmount } = await CouponService.evaluate(code, current.pricing.itemsTotal, userId);
    cart.appliedCoupon = { code: coupon.code, discountAmount };
    await cart.save();
    return this.getCart(userId, sessionId);
  }

  static async removeCoupon(userId?: string, sessionId?: string) {
    const cart = await this.findCart(userId, sessionId);
    if (!cart) throw AppError.notFound('Cart not found');
    cart.appliedCoupon = undefined;
    await cart.save();
    return this.getCart(userId, sessionId);
  }

  static async addItem(
    userId?: string,
    sessionId?: string,
    itemData?: { productId: string; sku: string; quantity: number }
  ) {
    if (!itemData) throw AppError.badRequest('Item data is required');

    const product = await Product.findById(itemData.productId);
    if (!product) throw AppError.notFound('Product not found');

    const variant = product.variants.find((v) => v.sku === itemData.sku);
    if (!variant) throw AppError.notFound('Product variant with specified SKU not found');

    if (variant.stock < itemData.quantity) {
      throw AppError.badRequest(`Insufficient stock. Only ${variant.stock} units available.`);
    }

    let cart = await this.findCart(userId, sessionId);
    if (!cart) {
      cart = new Cart({
        userId: userId ? new mongoose.Types.ObjectId(userId) : undefined,
        sessionId: !userId ? sessionId : undefined,
        items: [],
      });
    }

    const existingIndex = cart.items.findIndex((i) => i.sku === itemData.sku);
    if (existingIndex > -1) {
      const newQty = cart.items[existingIndex].quantity + itemData.quantity;
      if (variant.stock < newQty) {
        throw AppError.badRequest(`Cannot add more. Reached max available stock (${variant.stock}).`);
      }
      cart.items[existingIndex].quantity = newQty;
    } else {
      cart.items.push({
        productId: product._id,
        sku: itemData.sku,
        quantity: itemData.quantity,
        priceAtAddition: variant.price,
      });
    }

    await cart.save();
    return this.getCart(userId, sessionId);
  }

  static async updateQuantity(userId?: string, sessionId?: string, sku?: string, quantity?: number) {
    if (!sku || quantity === undefined) throw AppError.badRequest('SKU and quantity are required');

    const cart = await this.findCart(userId, sessionId);
    if (!cart) throw AppError.notFound('Cart not found');

    if (quantity <= 0) {
      cart.items = cart.items.filter((i) => i.sku !== sku);
    } else {
      const item = cart.items.find((i) => i.sku === sku);
      if (item) {
        const product = await Product.findById(item.productId);
        const variant = product?.variants.find((v) => v.sku === sku);
        if (variant && variant.stock < quantity) {
          throw AppError.badRequest(`Only ${variant.stock} units available in stock.`);
        }
        item.quantity = quantity;
      }
    }

    await cart.save();
    return this.getCart(userId, sessionId);
  }

  static async removeItem(userId?: string, sessionId?: string, sku?: string) {
    if (!sku) throw AppError.badRequest('SKU is required');

    const cart = await this.findCart(userId, sessionId);
    if (!cart) throw AppError.notFound('Cart not found');

    cart.items = cart.items.filter((i) => i.sku !== sku);
    await cart.save();
    return this.getCart(userId, sessionId);
  }

  static async mergeCart(userId: string, guestSessionId: string) {
    if (!guestSessionId) return this.getCart(userId);

    const guestCart = await Cart.findOne({ sessionId: guestSessionId });
    if (!guestCart || guestCart.items.length === 0) {
      return this.getCart(userId);
    }

    const userObjectId = new mongoose.Types.ObjectId(userId);
    let userCart = await Cart.findOne({ userId: userObjectId });

    if (!userCart) {
      // Re-assign guest cart to user
      guestCart.userId = userObjectId;
      guestCart.sessionId = undefined;
      await guestCart.save();
      return this.getCart(userId);
    }

    // Merge items from guest into user cart
    for (const gItem of guestCart.items) {
      const existing = userCart.items.find((u) => u.sku === gItem.sku);
      if (existing) {
        existing.quantity += gItem.quantity;
      } else {
        userCart.items.push(gItem);
      }
    }

    if (!userCart.appliedCoupon?.code && guestCart.appliedCoupon?.code) {
      userCart.appliedCoupon = guestCart.appliedCoupon;
    }

    await userCart.save();
    await Cart.deleteOne({ _id: guestCart._id });

    return this.getCart(userId);
  }
}
