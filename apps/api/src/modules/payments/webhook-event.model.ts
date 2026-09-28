import mongoose, { Document, Schema, Model } from 'mongoose';

export interface IWebhookEvent extends Document {
  eventId: string;
  event: string;
  payload: Record<string, unknown>;
  processedAt: Date;
  status: 'processing' | 'success' | 'failed' | 'ignored';
  error?: string;
}

const webhookEventSchema = new Schema<IWebhookEvent>(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    event: { type: String, required: true },
    payload: { type: Schema.Types.Mixed, required: true },
    processedAt: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ['processing', 'success', 'failed', 'ignored'],
      default: 'processing',
    },
    error: { type: String },
  },
  {
    timestamps: false,
  }
);

export const WebhookEvent: Model<IWebhookEvent> =
  mongoose.models.WebhookEvent ||
  mongoose.model<IWebhookEvent>('WebhookEvent', webhookEventSchema);
