import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IStockReservationItem {
  productId: mongoose.Types.ObjectId;
  sku: string;
  quantity: number;
}

export interface IStockReservation extends Document {
  orderId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  items: IStockReservationItem[];
  status: 'active' | 'committed' | 'released';
  expiresAt: Date;
  createdAt: Date;
}

const stockReservationSchema = new Schema<IStockReservation>(
  {
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
      {
        productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
        sku: { type: String, required: true },
        quantity: { type: Number, required: true },
      },
    ],
    status: {
      type: String,
      enum: ['active', 'committed', 'released'],
      default: 'active',
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expires: 0 }, // TTL index: automatically removed by MongoDB upon expiry
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

export const StockReservation: Model<IStockReservation> =
  mongoose.models.StockReservation ||
  mongoose.model<IStockReservation>('StockReservation', stockReservationSchema);
