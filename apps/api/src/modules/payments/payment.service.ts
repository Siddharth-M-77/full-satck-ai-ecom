import crypto from 'crypto';
import { Payment } from './payment.model.js';
import { Order } from '../orders/order.model.js';
import { WebhookEvent } from './webhook-event.model.js';
import { OrderService } from '../orders/order.service.js';
import { AppError } from '../../utils/app-error.js';
import { ORDER_STATUS } from '@shopsense/shared';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export class PaymentService {
  static verifySignature(
    razorpayOrderId: string,
    razorpayPaymentId: string,
    signature: string
  ): boolean {
    const secret = env.RAZORPAY_KEY_SECRET || (env.NODE_ENV === 'test' ? 'placeholder_secret' : undefined);
    if (!secret) throw AppError.serviceUnavailable('Razorpay payment verification is not configured');
    const body = `${razorpayOrderId}|${razorpayPaymentId}`;

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    // Constant-time comparison to prevent timing attacks
    return (
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      )
    );
  }

  static async confirmPayment(data: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  }) {
    const isValid = this.verifySignature(
      data.razorpayOrderId,
      data.razorpayPaymentId,
      data.razorpaySignature
    );

    if (!isValid) {
      throw AppError.badRequest('Invalid payment signature');
    }

    const payment = await Payment.findOne({
      razorpayOrderId: data.razorpayOrderId,
    });
    if (!payment) {
      throw AppError.notFound('Payment record not found');
    }

    payment.razorpayPaymentId = data.razorpayPaymentId;
    payment.razorpaySignature = data.razorpaySignature;
    payment.status = 'captured';
    await payment.save();

    // Mark order as PAID and commit stock
    const order = await OrderService.transitionStatus(
      payment.orderId.toString(),
      ORDER_STATUS.PAID,
      'Payment verified via client SDK'
    );

    return { success: true, order };
  }

  static async processWebhook(rawBody: string, signature: string, deliveryEventId?: string) {
    const secret = env.RAZORPAY_WEBHOOK_SECRET || (env.NODE_ENV === 'test' ? 'placeholder_webhook_secret' : undefined);
    if (!secret) throw AppError.serviceUnavailable('Razorpay webhooks are not configured');

    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(rawBody)
      .digest('hex');

    const isAuthentic =
      signature.length === expectedSignature.length &&
      crypto.timingSafeEqual(
        Buffer.from(signature, 'utf8'),
        Buffer.from(expectedSignature, 'utf8')
      );

    if (!isAuthentic) {
      logger.warn('Unauthorized webhook signature mismatch');
      throw AppError.forbidden('Invalid webhook signature');
    }

    let payload: Record<string, any>;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      throw AppError.badRequest('Invalid webhook payload');
    }

    const eventId = deliveryEventId || payload.event_id || payload.id;
    if (typeof eventId !== 'string' || eventId.length === 0) {
      throw AppError.badRequest('Webhook event ID is required');
    }

    let webhookRecord = await WebhookEvent.findOne({ eventId });
    if (webhookRecord?.status === 'success' || webhookRecord?.status === 'ignored') {
      logger.info({ eventId }, 'Webhook already processed. Skipping duplicate.');
      return { status: 'already_processed' };
    }

    if (webhookRecord?.status === 'processing') {
      return { status: 'processing' };
    }

    if (webhookRecord) {
      webhookRecord.status = 'processing';
      webhookRecord.error = undefined;
      webhookRecord.payload = payload;
      await webhookRecord.save();
    } else {
      try {
        webhookRecord = await WebhookEvent.create({
          eventId,
          event: payload.event || 'unknown',
          payload,
          status: 'processing',
        });
      } catch (error) {
        if ((error as { code?: number }).code === 11000) {
          return { status: 'processing' };
        }
        throw error;
      }
    }

    try {
      const paymentEntity = payload.payload?.payment?.entity;
      const rzpOrderId = paymentEntity?.order_id;

      if (payload.event === 'payment.captured' && rzpOrderId) {
        const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
        if (!payment) throw AppError.notFound('Payment record not found');
        if (payment.status !== 'captured') {
          await OrderService.transitionStatus(
            payment.orderId.toString(),
            ORDER_STATUS.PAID,
            'Payment captured via Webhook (Source of Truth)'
          );
          payment.status = 'captured';
        }
        payment.razorpayPaymentId = paymentEntity.id;
        payment.rawWebhookPayloads.push(payload);
        await payment.save();
      } else if (payload.event === 'payment.failed' && rzpOrderId) {
        const payment = await Payment.findOne({ razorpayOrderId: rzpOrderId });
        if (payment && payment.status !== 'captured') {
          payment.status = 'failed';
          payment.error = paymentEntity?.error_description || payload;
          await payment.save();

          await OrderService.releaseStock(payment.orderId);
        }
      } else {
        webhookRecord.status = 'ignored';
      }

      if (webhookRecord.status !== 'ignored') webhookRecord.status = 'success';
      webhookRecord.processedAt = new Date();
      await webhookRecord.save();
    } catch (err: unknown) {
      webhookRecord.status = 'failed';
      webhookRecord.error = err instanceof Error ? err.message : String(err);
      await webhookRecord.save();
      throw err;
    }

    return { status: 'processed' };
  }
}
