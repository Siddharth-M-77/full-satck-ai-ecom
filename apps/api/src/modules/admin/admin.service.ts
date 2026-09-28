import mongoose from 'mongoose';
import { Order } from '../orders/order.model.js';
import { Product } from '../catalog/product.model.js';
import { User } from '../users/user.model.js';
import { Payment } from '../payments/payment.model.js';
import { Coupon } from '../coupons/coupon.model.js';
import { AuditLog } from './audit-log.model.js';
import { InventoryLog } from './inventory-log.model.js';
import { OrderService } from '../orders/order.service.js';
import { AppError } from '../../utils/app-error.js';
import { ORDER_STATUS, USER_ROLES } from '@shopsense/shared';
import { getRazorpayClient } from '../../config/razorpay.js';
import { logger } from '../../config/logger.js';
import { env } from '../../config/env.js';

export class AdminService {
  static async getLowStock(threshold = 5) {
    const products = await Product.find({ 'variants.stock': { $lte: threshold } })
      .select('title slug variants')
      .lean();

    return products.flatMap((product) =>
      product.variants
        .filter((variant) => variant.stock <= threshold)
        .map((variant) => ({
          productId: product._id,
          title: product.title,
          slug: product.slug,
          sku: variant.sku,
          stock: variant.stock,
          threshold,
        }))
    );
  }

  static async getDashboardAnalytics() {
    const now = new Date();
    const todayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const weekStart = new Date(todayStart);
    weekStart.setUTCDate(weekStart.getUTCDate() - 6);
    const monthStart = new Date(todayStart);
    monthStart.setUTCDate(monthStart.getUTCDate() - 29);
    const paidStatuses = [ORDER_STATUS.PAID, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED];

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setUTCDate(yesterdayStart.getUTCDate() - 1);
    const previousWeekStart = new Date(weekStart);
    previousWeekStart.setUTCDate(previousWeekStart.getUTCDate() - 7);
    const previousMonthStart = new Date(monthStart);
    previousMonthStart.setUTCDate(previousMonthStart.getUTCDate() - 30);

    const summarizeSales = async (startDate: Date, endDate: Date = now) => {
      const [summary] = await Order.aggregate([
        { $match: { createdAt: { $gte: startDate, $lt: endDate === now ? new Date(now.getTime() + 1) : endDate }, status: { $in: paidStatuses } } },
        {
          $group: {
            _id: null,
            revenue: { $sum: '$pricing.grandTotal' },
            orders: { $sum: 1 },
            averageOrderValue: { $avg: '$pricing.grandTotal' },
          },
        },
      ]);
      return {
        revenue: summary?.revenue || 0,
        orders: summary?.orders || 0,
        averageOrderValue: Math.round(summary?.averageOrderValue || 0),
      };
    };

    const [
      today, last7Days, last30Days,
      yesterday, previous7Days, previous30Days,
      pendingOrders, recentOrders, lowStockItems, topProducts, products, trendRows,
      statusRows, categoryRows, totalCustomers, newCustomers, blockedCustomers,
    ] =
      await Promise.all([
        summarizeSales(todayStart),
        summarizeSales(weekStart),
        summarizeSales(monthStart),
        summarizeSales(yesterdayStart, todayStart),
        summarizeSales(previousWeekStart, weekStart),
        summarizeSales(previousMonthStart, monthStart),
        Order.countDocuments({ status: ORDER_STATUS.PENDING_PAYMENT }),
        Order.find().sort({ createdAt: -1 }).limit(8).lean(),
        this.getLowStock(5),
        Product.find({ salesCount: { $gt: 0 } })
          .sort({ salesCount: -1 })
          .limit(5)
          .select('title slug basePrice salesCount rating variants')
          .lean(),
        Product.find()
          .select('title slug status variants')
          .sort({ title: 1 })
          .lean(),
        Order.aggregate([
          {
            $match: {
              createdAt: { $gte: monthStart, $lte: now },
              status: { $in: paidStatuses },
            },
          },
          {
            $group: {
              _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
              revenue: { $sum: '$pricing.grandTotal' },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        Order.aggregate<{ _id: string; count: number }>([
          { $match: { createdAt: { $gte: monthStart, $lte: now } } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Order.aggregate<{ _id: string; name: string; revenue: number; units: number }>([
          { $match: { createdAt: { $gte: monthStart, $lte: now }, status: { $in: paidStatuses } } },
          { $unwind: '$items' },
          { $lookup: { from: 'products', localField: 'items.productId', foreignField: '_id', as: 'product' } },
          { $unwind: { path: '$product', preserveNullAndEmptyArrays: true } },
          { $lookup: { from: 'categories', localField: 'product.categoryId', foreignField: '_id', as: 'category' } },
          { $unwind: { path: '$category', preserveNullAndEmptyArrays: true } },
          {
            $group: {
              _id: { $ifNull: ['$category._id', 'uncategorized'] },
              name: { $first: { $ifNull: ['$category.name', 'Uncategorized'] } },
              revenue: { $sum: '$items.subtotal' },
              units: { $sum: '$items.quantity' },
            },
          },
          { $sort: { revenue: -1 } },
          { $limit: 8 },
        ]),
        User.countDocuments({ role: USER_ROLES.CUSTOMER }),
        User.countDocuments({ role: USER_ROLES.CUSTOMER, createdAt: { $gte: monthStart } }),
        User.countDocuments({ role: USER_ROLES.CUSTOMER, isBlocked: true }),
      ]);

    const trendByDate = new Map(trendRows.map((row) => [row._id, row]));
    const salesTrend = Array.from({ length: 30 }, (_, index) => {
      const day = new Date(monthStart);
      day.setUTCDate(monthStart.getUTCDate() + index);
      const date = day.toISOString().slice(0, 10);
      const row = trendByDate.get(date);
      return { _id: date, revenue: row?.revenue || 0, orders: row?.orders || 0 };
    });

    const inventory = products.flatMap((product) =>
      product.variants.map((variant) => ({
        productId: product._id,
        title: product.title,
        slug: product.slug,
        productStatus: product.status,
        sku: variant.sku,
        attributes: variant.attributes,
        price: variant.price,
        stock: variant.stock,
        lowStock: variant.stock <= 5,
      }))
    );

    return {
      overview: {
        totalRevenue: last30Days.revenue,
        totalOrders: last30Days.orders,
        avgOrderValue: last30Days.averageOrderValue,
        lowStockCount: lowStockItems.length,
        pendingOrders,
        totalProducts: products.length,
        totalVariants: inventory.length,
        totalUnitsInStock: inventory.reduce((sum, variant) => sum + variant.stock, 0),
        outOfStockCount: inventory.filter((variant) => variant.stock === 0).length,
      },
      salesPeriods: { today, last7Days, last30Days },
      salesTrend,
      recentOrders,
      lowStockProducts: lowStockItems,
      topProducts,
      inventory,
    };
  }

  static async adjustStock(data: {
    productId: string;
    sku: string;
    changeQuantity: number;
    notes?: string;
    adminUserId: string;
    adminEmail: string;
  }) {
    const product = await Product.findById(data.productId);
    if (!product) throw AppError.notFound('Product not found');

    const variant = product.variants.find((v) => v.sku === data.sku);
    if (!variant) throw AppError.notFound('Variant SKU not found');

    const previousStock = variant.stock;
    const newStock = previousStock + data.changeQuantity;
    if (newStock < 0) {
      throw AppError.badRequest('Stock cannot be adjusted below zero');
    }

    variant.stock = newStock;
    await product.save();

    await InventoryLog.create({
      productId: product._id,
      sku: data.sku,
      changeType: data.changeQuantity >= 0 ? 'RESTOCK' : 'MANUAL_ADJUSTMENT',
      previousStock,
      changeQuantity: data.changeQuantity,
      newStock,
      performedBy: new mongoose.Types.ObjectId(data.adminUserId),
      notes: data.notes,
    });

    await AuditLog.create({
      userId: new mongoose.Types.ObjectId(data.adminUserId),
      userEmail: data.adminEmail,
      action: 'STOCK_ADJUSTMENT',
      resourceType: 'ProductVariant',
      resourceId: data.sku,
      diff: { before: { stock: previousStock }, after: { stock: newStock } },
    });

    return { sku: data.sku, previousStock, newStock };
  }

  static async processRefund(orderId: string, reason?: string, adminUserId?: string, adminEmail?: string) {
    const order = await Order.findById(orderId);
    if (!order) throw AppError.notFound('Order not found');

    if (order.status !== ORDER_STATUS.PAID && order.status !== ORDER_STATUS.REFUND_REQUESTED) {
      throw AppError.badRequest('Only paid or refund-requested orders can be refunded');
    }

    const payment = await Payment.findOne({ orderId: order._id });
    if (!payment || !payment.razorpayPaymentId || payment.status !== 'captured') {
      throw AppError.badRequest('A captured Razorpay payment is required to issue a refund');
    }

    if (payment.refunds.some((refund) => refund.status !== 'failed')) {
      throw AppError.conflict('A refund has already been requested for this payment');
    }

    let refund: { id: string; status: string };
    if (env.NODE_ENV === 'test') {
      refund = { id: `rfnd_test_${Date.now()}`, status: 'processed' };
    } else {
      const razorpay = getRazorpayClient();
      const razorpayRefund = await razorpay.payments.refund(payment.razorpayPaymentId, {
        amount: payment.amount,
        notes: { reason: reason || 'Administrator refund', orderNumber: order.orderNumber },
      });
      refund = { id: razorpayRefund.id, status: razorpayRefund.status };
    }

    payment.refunds.push({
      refundId: refund.id,
      amount: payment.amount,
      status: refund.status,
      createdAt: new Date(),
    });
    await payment.save();

    if (order.status === ORDER_STATUS.PAID) {
      await OrderService.transitionStatus(
        order.id,
        ORDER_STATUS.REFUND_REQUESTED,
        reason || 'Full refund requested by administrator',
        adminUserId
      );
    }

    const updatedOrder = refund.status === 'processed'
      ? await this.finalizeRefund(order.id, refund.id, reason, adminUserId, adminEmail)
      : await Order.findById(order.id);

    if (adminUserId && adminEmail) {
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(adminUserId),
        userEmail: adminEmail,
        action: refund.status === 'processed' ? 'REFUND_ISSUED' : 'REFUND_REQUESTED',
        resourceType: 'Order',
        resourceId: order.orderNumber,
        diff: { status: refund.status, amount: payment.amount, refundId: refund.id },
      });
    }

    return updatedOrder;
  }

  static async finalizeRefund(
    orderId: string | mongoose.Types.ObjectId,
    refundId: string,
    reason?: string,
    adminUserId?: string,
    adminEmail?: string
  ) {
    const order = await Order.findById(orderId);
    if (!order) throw AppError.notFound('Order not found');
    const payment = await Payment.findOne({ orderId: order._id });
    if (!payment) throw AppError.notFound('Payment record not found');

    const refund = payment.refunds.find((entry) => entry.refundId === refundId);
    if (!refund) throw AppError.notFound('Refund record not found');
    if (order.status === ORDER_STATUS.REFUNDED) return order;
    if (refund.status !== 'processed') return order;

    for (const item of order.items) {
      const product = await Product.findOneAndUpdate(
        { _id: item.productId, 'variants.sku': item.sku },
        { $inc: { 'variants.$.stock': item.quantity } },
        { new: true }
      );
      const variant = product?.variants.find((entry) => entry.sku === item.sku);
      const newStock = variant?.stock ?? item.quantity;

      await InventoryLog.create({
        productId: item.productId,
        sku: item.sku,
        changeType: 'REFUND_RESTOCK',
        previousStock: newStock - item.quantity,
        changeQuantity: item.quantity,
        newStock,
        orderId: order._id,
        notes: `Refund restock for order ${order.orderNumber}`,
      });
    }

    payment.status = 'refunded';
    await payment.save();

    if (order.status === ORDER_STATUS.PAID) {
      await OrderService.transitionStatus(order.id, ORDER_STATUS.REFUND_REQUESTED, reason);
    }
    const refundedOrder = await OrderService.transitionStatus(
      order.id,
      ORDER_STATUS.REFUNDED,
      reason || 'Refund processed by Razorpay',
      adminUserId
    );

    if (adminUserId && adminEmail) {
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(adminUserId),
        userEmail: adminEmail,
        action: 'REFUND_ISSUED',
        resourceType: 'Order',
        resourceId: order.orderNumber,
        diff: { status: ORDER_STATUS.REFUNDED, amount: refund.amount, refundId },
      });
    }

    return refundedOrder;
  }
}
