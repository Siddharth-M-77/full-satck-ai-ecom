import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IPayment extends Document {
  orderId: mongoose.Types.ObjectId;
  razorpayOrderId: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
  amount: number; // in paise
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'failed' | 'refunded';
  method?: string;
  error?: Record<string, unknown>;
  refunds: Array<{
    refundId: string;
    amount: number;
    status: string;
    createdAt: Date;
  }>;
  rawWebhookPayloads: Array<Record<string, unknown>>;
  createdAt: Date;
  updatedAt: Date;
}

const paymentSchema = new Schema<IPayment>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    razorpayOrderId: { type: String, required: true, index: true },
    razorpayPaymentId: { type: String, index: true },
    razorpaySignature: { type: String },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'INR' },
    status: {
      type: String,
      enum: ['created', 'authorized', 'captured', 'failed', 'refunded'],
      default: 'created',
      index: true,
    },
    method: { type: String },
    error: { type: Schema.Types.Mixed },
    refunds: [
      {
        refundId: { type: String },
        amount: { type: Number },
        status: { type: String },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    rawWebhookPayloads: [{ type: Schema.Types.Mixed }],
  },
  {
    timestamps: true,
  }
);

export const Payment: Model<IPayment> =
  mongoose.models.Payment || mongoose.model<IPayment>('Payment', paymentSchema);
