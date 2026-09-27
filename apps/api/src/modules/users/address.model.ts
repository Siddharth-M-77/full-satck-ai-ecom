import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IAddress extends Document {
  userId: mongoose.Types.ObjectId;
  fullName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
  type: 'shipping' | 'billing' | 'both';
  createdAt: Date;
  updatedAt: Date;
}

const addressSchema = new Schema<IAddress>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    fullName: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    addressLine1: { type: String, required: true, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, required: true, trim: true },
    state: { type: String, required: true, trim: true },
    postalCode: { type: String, required: true, trim: true },
    country: { type: String, default: 'IN', trim: true },
    isDefault: { type: Boolean, default: false },
    type: {
      type: String,
      enum: ['shipping', 'billing', 'both'],
      default: 'shipping',
    },
  },
  {
    timestamps: true,
  }
);

addressSchema.index({ userId: 1, isDefault: -1 });

export const Address: Model<IAddress> =
  mongoose.models.Address || mongoose.model<IAddress>('Address', addressSchema);
