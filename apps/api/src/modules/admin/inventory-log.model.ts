import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IInventoryLog extends Document {
  productId: mongoose.Types.ObjectId;
  sku: string;
  changeType: 'RESTOCK' | 'ORDER_RESERVED' | 'ORDER_CANCELLED' | 'ORDER_PAID' | 'MANUAL_ADJUSTMENT' | 'REFUND_RESTOCK';
  previousStock: number;
  changeQuantity: number;
  newStock: number;
  orderId?: mongoose.Types.ObjectId;
  performedBy?: mongoose.Types.ObjectId;
  notes?: string;
  createdAt: Date;
}

const inventoryLogSchema = new Schema<IInventoryLog>(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    sku: { type: String, required: true, index: true },
    changeType: {
      type: String,
      enum: ['RESTOCK', 'ORDER_RESERVED', 'ORDER_CANCELLED', 'ORDER_PAID', 'MANUAL_ADJUSTMENT', 'REFUND_RESTOCK'],
      required: true,
    },
    previousStock: { type: Number, required: true },
    changeQuantity: { type: Number, required: true },
    newStock: { type: Number, required: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order' },
    performedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    notes: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

inventoryLogSchema.index({ productId: 1, createdAt: -1 });

export const InventoryLog: Model<IInventoryLog> =
  mongoose.models.InventoryLog ||
  mongoose.model<IInventoryLog>('InventoryLog', inventoryLogSchema);
