import mongoose from 'mongoose';
import { Coupon, ICoupon } from './coupon.model.js';
import { Order } from '../orders/order.model.js';
import { AppError } from '../../utils/app-error.js';
import { ORDER_STATUS } from '@shopsense/shared';

export type CouponEvaluation = { coupon: ICoupon; discountAmount: number };

export class CouponService {
  static discountFor(coupon: Pick<ICoupon, 'discountType' | 'discountValue' | 'maxDiscount'>, itemsTotal: number) {
    const raw = coupon.discountType === 'percentage'
      ? Math.round((itemsTotal * coupon.discountValue) / 100)
      : coupon.discountValue;
    const capped = coupon.maxDiscount ? Math.min(raw, coupon.maxDiscount) : raw;
    return Math.max(0, Math.min(capped, itemsTotal));
  }

  /**
   * Validates a code against the current basket. The per-customer limit can only be checked
   * once we know who the customer is, so guests are checked again at checkout.
   */
  static async evaluate(code: string, itemsTotal: number, userId?: string): Promise<CouponEvaluation> {
    const normalized = code.trim().toUpperCase();
    if (!normalized) throw AppError.badRequest('Enter a coupon code');

    const coupon = await Coupon.findOne({ code: normalized });
    const now = new Date();
    if (!coupon || !coupon.isActive) throw AppError.badRequest('This coupon code is not valid');
    if (coupon.startDate > now) throw AppError.badRequest('This coupon is not active yet');
    if (coupon.endDate < now) throw AppError.badRequest('This coupon has expired');
    if (coupon.usageLimitGlobal !== undefined && coupon.usedCount >= coupon.usageLimitGlobal) {
      throw AppError.badRequest('This coupon has reached its usage limit');
    }
    if (itemsTotal < coupon.minOrderValue) {
      const short = coupon.minOrderValue - itemsTotal;
      throw AppError.badRequest(`Add items worth ₹${short.toLocaleString('en-IN')} more to use ${coupon.code}`);
    }

    if (userId) {
      const previousUses = await Order.countDocuments({
        userId: new mongoose.Types.ObjectId(userId),
        couponCode: coupon.code,
        status: { $ne: ORDER_STATUS.CANCELLED },
      });
      if (previousUses >= coupon.usageLimitPerUser) {
        throw AppError.badRequest(`You have already used ${coupon.code} the maximum number of times`);
      }
    }

    return { coupon, discountAmount: this.discountFor(coupon, itemsTotal) };
  }

  /** Claims one use atomically so two simultaneous checkouts cannot overshoot the global limit. */
  static async claimUse(code: string) {
    const claimed = await Coupon.findOneAndUpdate(
      {
        code,
        $or: [
          { usageLimitGlobal: { $exists: false } },
          { usageLimitGlobal: null },
          { $expr: { $lt: ['$usedCount', '$usageLimitGlobal'] } },
        ],
      },
      { $inc: { usedCount: 1 } },
      { new: true }
    );
    if (!claimed) throw AppError.badRequest('This coupon has reached its usage limit');
  }

  static async releaseUse(code?: string) {
    if (!code) return;
    await Coupon.updateOne({ code, usedCount: { $gt: 0 } }, { $inc: { usedCount: -1 } });
  }

  /** Coupons the admin chose to advertise, which are live and not used up. */
  static async listOffers() {
    const now = new Date();
    const coupons = await Coupon.find({
      isActive: true,
      showInOffers: true,
      startDate: { $lte: now },
      endDate: { $gte: now },
    })
      .select('code discountType discountValue minOrderValue maxDiscount endDate usageLimitGlobal usedCount')
      .sort({ endDate: 1 })
      .lean();

    return coupons
      .filter((coupon) => coupon.usageLimitGlobal === undefined || coupon.usageLimitGlobal === null || coupon.usedCount < coupon.usageLimitGlobal)
      .map(({ usageLimitGlobal: _limit, usedCount: _used, ...offer }) => offer);
  }
}
