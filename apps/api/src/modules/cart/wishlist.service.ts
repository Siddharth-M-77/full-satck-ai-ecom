import mongoose from 'mongoose';
import { Wishlist } from './wishlist.model.js';
import { Product } from '../catalog/product.model.js';
import { AppError } from '../../utils/app-error.js';

export class WishlistService {
  static async getWishlist(userId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    let wishlist = await Wishlist.findOne({ userId: userObjectId }).populate({
      path: 'productIds',
      select: 'title slug basePrice compareAtPrice variants rating isFeatured',
    });

    if (!wishlist) {
      wishlist = await Wishlist.create({
        userId: userObjectId,
        productIds: [],
      });
    }

    return wishlist;
  }

  static async addProduct(userId: string, productId: string) {
    const product = await Product.findById(productId);
    if (!product) throw AppError.notFound('Product not found');

    const userObjectId = new mongoose.Types.ObjectId(userId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    let wishlist = await Wishlist.findOne({ userId: userObjectId });
    if (!wishlist) {
      wishlist = new Wishlist({
        userId: userObjectId,
        productIds: [productObjectId],
      });
    } else {
      if (!wishlist.productIds.some((p) => p.equals(productObjectId))) {
        wishlist.productIds.push(productObjectId);
      }
    }

    await wishlist.save();
    return this.getWishlist(userId);
  }

  static async removeProduct(userId: string, productId: string) {
    const userObjectId = new mongoose.Types.ObjectId(userId);
    const productObjectId = new mongoose.Types.ObjectId(productId);

    await Wishlist.updateOne(
      { userId: userObjectId },
      { $pull: { productIds: productObjectId } }
    );

    return this.getWishlist(userId);
  }
}
