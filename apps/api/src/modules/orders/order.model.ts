import mongoose, { Document, Schema, Model } from 'mongoose';
import { ORDER_STATUS, OrderStatus, PAYMENT_METHODS, PaymentMethod } from '@shopsense/shared';

export interface IOrderItem {
  productId: mongoose.Types.ObjectId;
  sku: string;
  title: string;
  variantAttributes: Record<string, string>;
  unitPrice: number;
  quantity: number;
  subtotal: number;
  image?: string;
}

export interface IOrderPricing {
  itemsTotal: number;
  discountTotal: number;
  shippingFee: number;
  taxTotal: number;
  grandTotal: number;
}

export interface IOrderStatusHistory {
  status: OrderStatus;
  timestamp: Date;
  comment?: string;
  updatedBy?: mongoose.Types.ObjectId;
}

export interface IOrder extends Document {
  orderNumber: string;
  userId: mongoose.Types.ObjectId;
  items: IOrderItem[];
  pricing: IOrderPricing;
  shippingAddress: Record<string, unknown>;
  billingAddress?: Record<string, unknown>;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  statusHistory: IOrderStatusHistory[];
  paymentId?: mongoose.Types.ObjectId;
  fulfillment?: {
    trackingNumber?: string;
    carrier?: string;
    shippedAt?: Date;
    deliveredAt?: Date;
  };
  invoiceUrl?: string;
  cancellationReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const orderItemSchema = new Schema<IOrderItem>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    title: { type: String, required: true },
    variantAttributes: { type: Map, of: String, default: {} },
    unitPrice: { type: Number, required: true },
    quantity: { type: Number, required: true, min: 1 },
    subtotal: { type: Number, required: true },
    image: { type: String },
  },
  { _id: true }
);

const orderStatusHistorySchema = new Schema<IOrderStatusHistory>(
  {
    status: { type: String, enum: Object.values(ORDER_STATUS), required: true },
    timestamp: { type: Date, default: Date.now },
    comment: { type: String },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
    orderNumber: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    items: [orderItemSchema],
    pricing: {
      itemsTotal: { type: Number, required: true },
      discountTotal: { type: Number, default: 0 },
      shippingFee: { type: Number, default: 0 },
      taxTotal: { type: Number, default: 0 },
      grandTotal: { type: Number, required: true },
    },
    shippingAddress: { type: Schema.Types.Mixed, required: true },
    billingAddress: { type: Schema.Types.Mixed },
    paymentMethod: {
      type: String,
      enum: Object.values(PAYMENT_METHODS),
      default: PAYMENT_METHODS.RAZORPAY,
    },
    status: {
      type: String,
      enum: Object.values(ORDER_STATUS),
      default: ORDER_STATUS.PENDING_PAYMENT,
      index: true,
    },
    statusHistory: [orderStatusHistorySchema],
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment' },
    fulfillment: {
      trackingNumber: { type: String },
      carrier: { type: String },
      shippedAt: { type: Date },
      deliveredAt: { type: Date },
    },
    invoiceUrl: { type: String },
    cancellationReason: { type: String },
  },
  {
    timestamps: true,
  }
);

orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

export const Order: Model<IOrder> =
  mongoose.models.Order || mongoose.model<IOrder>('Order', orderSchema);
