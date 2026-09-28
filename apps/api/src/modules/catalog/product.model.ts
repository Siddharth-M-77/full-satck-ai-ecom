import mongoose, { Document, Schema, Model } from 'mongoose';
import { PRODUCT_STATUS, ProductStatus } from '@shopsense/shared';

export interface IVariantImage {
  url: string;
  publicId?: string;
  isPrimary?: boolean;
}

export interface IProductVariant {
  sku: string;
  attributes: Record<string, string>;
  price: number;
  compareAtPrice?: number;
  stock: number;
  images: IVariantImage[];
}

export interface IProductSEO {
  metaTitle?: string;
  metaDescription?: string;
  keywords?: string[];
}

export interface IProductRating {
  average: number;
  count: number;
}

export interface IProduct extends Document {
  title: string;
  slug: string;
  description: string;
  bulletPoints: string[];
  categoryId: mongoose.Types.ObjectId;
  brandId?: mongoose.Types.ObjectId;
  basePrice: number;
  compareAtPrice?: number;
  variants: IProductVariant[];
  tags: string[];
  embedding?: number[];
  rating: IProductRating;
  salesCount: number;
  status: ProductStatus;
  isFeatured: boolean;
  seo?: IProductSEO;
  createdAt: Date;
  updatedAt: Date;
}

const variantImageSchema = new Schema<IVariantImage>(
  {
    url: { type: String, required: true },
    publicId: { type: String },
    isPrimary: { type: Boolean, default: false },
  },
  { _id: false }
);

const variantSchema = new Schema<IProductVariant>(
  {
    sku: { type: String, required: true, trim: true },
    attributes: { type: Map, of: String, default: {} },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, min: 0 },
    stock: { type: Number, required: true, min: 0, default: 0 },
    images: [variantImageSchema],
  },
  { _id: true }
);

const productSchema = new Schema<IProduct>(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    description: { type: String, required: true },
    bulletPoints: [{ type: String }],
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', required: true, index: true },
    brandId: { type: Schema.Types.ObjectId, ref: 'Brand', index: true },
    basePrice: { type: Number, required: true, min: 0, index: true },
    compareAtPrice: { type: Number, min: 0 },
    variants: [variantSchema],
    tags: [{ type: String, index: true }],
    embedding: { type: [Number], select: false },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    salesCount: { type: Number, default: 0, index: true },
    status: {
      type: String,
      enum: Object.values(PRODUCT_STATUS),
      default: PRODUCT_STATUS.PUBLISHED,
      index: true,
    },
    isFeatured: { type: Boolean, default: false, index: true },
    seo: {
      metaTitle: { type: String },
      metaDescription: { type: String },
      keywords: [{ type: String }],
    },
  },
  {
    timestamps: true,
  }
);

productSchema.index({ categoryId: 1, status: 1, basePrice: 1 });
productSchema.index({ 'variants.sku': 1 });
productSchema.index({ title: 'text', description: 'text', tags: 'text' });

export const Product: Model<IProduct> =
  mongoose.models.Product || mongoose.model<IProduct>('Product', productSchema);
