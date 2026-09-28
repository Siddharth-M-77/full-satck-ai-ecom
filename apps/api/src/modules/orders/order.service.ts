import mongoose from 'mongoose';
import crypto from 'crypto';
import { Order, IOrder } from './order.model.js';
import { StockReservation } from './stock-reservation.model.js';
import { Payment } from '../payments/payment.model.js';
import { Product } from '../catalog/product.model.js';
import { Cart } from '../cart/cart.model.js';
import { AppError } from '../../utils/app-error.js';
import { ORDER_STATUS, OrderStatus, PAYMENT_METHODS, PaymentMethod } from '@shopsense/shared';
import { getRazorpayClient } from '../../config/razorpay.js';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

// Order State Machine valid transition rules
const ALLOWED_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [ORDER_STATUS.PENDING_PAYMENT]: [ORDER_STATUS.PAID, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.PAID]: [ORDER_STATUS.PROCESSING, ORDER_STATUS.CANCELLED, ORDER_STATUS.REFUND_REQUESTED],
  [ORDER_STATUS.PROCESSING]: [ORDER_STATUS.SHIPPED, ORDER_STATUS.CANCELLED],
  [ORDER_STATUS.SHIPPED]: [ORDER_STATUS.DELIVERED],
  [ORDER_STATUS.DELIVERED]: [ORDER_STATUS.REFUND_REQUESTED],
  [ORDER_STATUS.CANCELLED]: [],
  [ORDER_STATUS.REFUND_REQUESTED]: [ORDER_STATUS.REFUNDED, ORDER_STATUS.PAID],
  [ORDER_STATUS.REFUNDED]: [],
};

export class OrderService {
  static async reserveStock(
    userId: string,
    orderId: mongoose.Types.ObjectId,
    items: Array<{ productId: string; sku: string; quantity: number }>
  ) {
    const reservedItems: Array<{ productId: string; sku: string; quantity: number }> = [];

    for (const item of items) {
      // Atomic conditional update guaranteeing concurrency safety
      const updatedProduct = await Product.findOneAndUpdate(
        {
          _id: item.productId,
          'variants.sku': item.sku,
          'variants.stock': { $gte: item.quantity },
        },
        {
          $inc: { 'variants.$.stock': -item.quantity },
        },
        { new: true }
      );

      if (!updatedProduct) {
        // Rollback already reserved items
        for (const reserved of reservedItems) {
          await Product.updateOne(
            { _id: reserved.productId, 'variants.sku': reserved.sku },
            { $inc: { 'variants.$.stock': reserved.quantity } }
          );
        }
        throw AppError.badRequest(
          `Stock reservation failed for item SKU: ${item.sku}. Insufficient inventory.`
        );
      }

      reservedItems.push(item);
    }

    // Create reservation record with 15-minute TTL
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    const reservation = await StockReservation.create({
      orderId,
      userId: new mongoose.Types.ObjectId(userId),
      items: items.map((i) => ({
        productId: new mongoose.Types.ObjectId(i.productId),
        sku: i.sku,
        quantity: i.quantity,
      })),
      status: 'active',
      expiresAt,
    });

    return reservation;
  }

  static async releaseStock(orderId: string | mongoose.Types.ObjectId) {
    const reservation = await StockReservation.findOne({ orderId, status: 'active' });
    if (!reservation) return;

    for (const item of reservation.items) {
      await Product.updateOne(
        { _id: item.productId, 'variants.sku': item.sku },
        { $inc: { 'variants.$.stock': item.quantity } }
      );
    }

    reservation.status = 'released';
    await reservation.save();
    logger.info({ orderId }, 'Stock reservation released');
  }

  static async commitStock(orderId: string | mongoose.Types.ObjectId) {
    await StockReservation.updateOne(
      { orderId, status: 'active' },
      { $set: { status: 'committed' } }
    );
  }

  static async createOrder(
    userId: string,
    data: {
      shippingAddress: Record<string, unknown>;
      paymentMethod?: PaymentMethod;
      guestSessionId?: string;
    }
  ) {
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // Retrieve active cart
    const cart = await Cart.findOne({ userId: userObjectId });
    if (!cart || cart.items.length === 0) {
      throw AppError.badRequest('Cannot place an order with an empty cart');
    }

    // Populate and compute pricing
    const orderItems: any[] = [];
    let itemsTotal = 0;

    for (const item of cart.items) {
      const product = await Product.findById(item.productId);
      if (!product) throw AppError.notFound(`Product not found: ${item.productId}`);

      const variant = product.variants.find((v) => v.sku === item.sku);
      if (!variant) throw AppError.notFound(`Variant not found for SKU: ${item.sku}`);

      const subtotal = variant.price * item.quantity;
      itemsTotal += subtotal;

      orderItems.push({
        productId: product._id,
        sku: item.sku,
        title: product.title,
        variantAttributes: variant.attributes,
        unitPrice: variant.price,
        quantity: item.quantity,
        subtotal,
        image: variant.images?.[0]?.url || '',
      });
    }

    const discountTotal = cart.appliedCoupon?.discountAmount || 0;
    const shippingFee = itemsTotal > 999 ? 0 : 99;
    const taxTotal = Math.round(itemsTotal * 0.18);
    const grandTotal = Math.max(0, itemsTotal - discountTotal + shippingFee + taxTotal);

    const orderNumber = `SS-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
    const orderId = new mongoose.Types.ObjectId();

    // 1. Atomically reserve stock
    await this.reserveStock(
      userId,
      orderId,
      orderItems.map((i) => ({
        productId: i.productId.toString(),
        sku: i.sku,
        quantity: i.quantity,
      }))
    );

    // 2. Create Order document
    const order = new Order({
      _id: orderId,
      orderNumber,
      userId: userObjectId,
      items: orderItems,
      pricing: {
        itemsTotal,
        discountTotal,
        shippingFee,
        taxTotal,
        grandTotal,
      },
      shippingAddress: data.shippingAddress,
      paymentMethod: data.paymentMethod || PAYMENT_METHODS.RAZORPAY,
      status:
        data.paymentMethod === PAYMENT_METHODS.COD
          ? ORDER_STATUS.PROCESSING
          : ORDER_STATUS.PENDING_PAYMENT,
      statusHistory: [
        {
          status:
            data.paymentMethod === PAYMENT_METHODS.COD
              ? ORDER_STATUS.PROCESSING
              : ORDER_STATUS.PENDING_PAYMENT,
          timestamp: new Date(),
          comment: 'Order placed',
        },
      ],
    });

    await order.save();

    // 3. If Razorpay, initialize Razorpay Order
    let razorpayOrderData: any = null;
    if (order.paymentMethod === PAYMENT_METHODS.RAZORPAY) {
      if (env.NODE_ENV === 'test') {
        const mockRzpId = `order_test_${crypto.randomBytes(8).toString('hex')}`;
        const payment = await Payment.create({
          orderId: order._id,
          razorpayOrderId: mockRzpId,
          amount: Math.round(grandTotal * 100),
          currency: 'INR',
          status: 'created',
        });

        order.paymentId = payment._id;
        await order.save();
        razorpayOrderData = {
          id: mockRzpId,
          amount: Math.round(grandTotal * 100),
          currency: 'INR',
          keyId: env.RAZORPAY_KEY_ID || 'rzp_test_placeholder',
        };
      } else {
        try {
          const razorpay = getRazorpayClient();
          const rzpOrder = await razorpay.orders.create({
            amount: Math.round(grandTotal * 100),
            currency: 'INR',
            receipt: order.orderNumber,
          });

          const payment = await Payment.create({
            orderId: order._id,
            razorpayOrderId: rzpOrder.id,
            amount: Math.round(grandTotal * 100),
            currency: 'INR',
            status: 'created',
          });

          order.paymentId = payment._id;
          await order.save();
          razorpayOrderData = {
            id: rzpOrder.id,
            amount: rzpOrder.amount,
            currency: 'INR',
            keyId: env.RAZORPAY_KEY_ID,
          };
        } catch (err: unknown) {
          logger.error({ err }, 'Razorpay order creation failed');
          await this.releaseStock(order._id);
          await Payment.deleteOne({ orderId: order._id });
          await Order.deleteOne({ _id: order._id });
          throw AppError.serviceUnavailable('Unable to start Razorpay checkout. Please retry.');
        }
      }
    } else {
      await this.commitStock(order._id);
    }

    cart.items = [];
    cart.appliedCoupon = undefined;
    await cart.save();

    return {
      order,
      razorpayOrder: razorpayOrderData,
    };
  }

  static async transitionStatus(
    orderId: string,
    newStatus: OrderStatus,
    comment?: string,
    updatedBy?: string
  ) {
    const order = await Order.findById(orderId);
    if (!order) throw AppError.notFound('Order not found');

    const allowed = ALLOWED_TRANSITIONS[order.status];
    if (!allowed || !allowed.includes(newStatus)) {
      throw AppError.badRequest(
        `Invalid order status transition from ${order.status} to ${newStatus}`
      );
    }

    order.status = newStatus;
    order.statusHistory.push({
      status: newStatus,
      timestamp: new Date(),
      comment,
      updatedBy: updatedBy ? new mongoose.Types.ObjectId(updatedBy) : undefined,
    });

    if (newStatus === ORDER_STATUS.PAID) {
      await this.commitStock(order._id);
    } else if (newStatus === ORDER_STATUS.CANCELLED) {
      await this.releaseStock(order._id);
    }

    await order.save();
    return order;
  }
}
