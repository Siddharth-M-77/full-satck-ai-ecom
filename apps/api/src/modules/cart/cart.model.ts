import mongoose, { Document, Schema, Model } from 'mongoose';

export interface ICartItem {
  _id?: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId;
  sku: string;
  quantity: number;
  priceAtAddition: number;
}

export interface ICart extends Document {
  userId?: mongoose.Types.ObjectId;
  sessionId?: string;
  items: ICartItem[];
  appliedCoupon?: {
    code: string;
    discountAmount: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const cartItemSchema = new Schema<ICartItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, default: 1 },
    priceAtAddition: { type: Number, required: true },
  },
  { _id: true }
);

const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    sessionId: { type: String, index: true },
    items: [cartItemSchema],
    appliedCoupon: {
      code: { type: String },
      discountAmount: { type: Number, default: 0 },
    },
  },
  {
    timestamps: true,
  }
);

export const Cart: Model<ICart> =
  mongoose.models.Cart || mongoose.model<ICart>('Cart', cartSchema);
