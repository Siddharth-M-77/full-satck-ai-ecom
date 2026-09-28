import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IBrand extends Document {
  name: string;
  slug: string;
  logo?: {
    url: string;
    publicId?: string;
  };
  website?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const brandSchema = new Schema<IBrand>(
  {
    name: { type: String, required: true, trim: true, unique: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    logo: {
      url: { type: String },
      publicId: { type: String },
    },
    website: { type: String, trim: true },
    isActive: { type: Boolean, default: true, index: true },
  },
  {
    timestamps: true,
  }
);

export const Brand: Model<IBrand> =
  mongoose.models.Brand || mongoose.model<IBrand>('Brand', brandSchema);
