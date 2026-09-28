import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICoupon extends Document {
  code: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  minOrderValue: number;
  maxDiscount?: number;
  startDate: Date;
  endDate: Date;
  usageLimitGlobal?: number;
  usageLimitPerUser: number;
  usedCount: number;
  isActive: boolean;
  showInOffers: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const couponSchema = new Schema<ICoupon>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    discountType: { type: String, enum: ['percentage', 'flat'], required: true },
    discountValue: { type: Number, required: true, min: 1 },
    minOrderValue: { type: Number, default: 0 },
    maxDiscount: { type: Number },
    startDate: { type: Date, required: true, default: Date.now },
    endDate: { type: Date, required: true, index: true },
    usageLimitGlobal: { type: Number },
    usageLimitPerUser: { type: Number, default: 1 },
    usedCount: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true, index: true },
    // Advertised on the storefront offers strip; codes stay private unless the admin opts in.
    showInOffers: { type: Boolean, default: false },
  },
  {
    timestamps: true,
  }
);

export const Coupon: Model<ICoupon> =
  mongoose.models.Coupon || mongoose.model<ICoupon>('Coupon', couponSchema);
