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

export class AdminService {
  static async getDashboardAnalytics() {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // 1. Revenue & Orders Aggregation
    const [salesSummary, recentOrders, lowStockProducts, topProducts] =
      await Promise.all([
        Order.aggregate([
          { $match: { status: { $in: [ORDER_STATUS.PAID, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED] } } },
          {
            $group: {
              _id: null,
              totalRevenue: { $sum: '$pricing.grandTotal' },
              totalOrders: { $sum: 1 },
              avgOrderValue: { $avg: '$pricing.grandTotal' },
            },
          },
        ]),

        Order.find().sort({ createdAt: -1 }).limit(8).lean(),

        Product.find({ 'variants.stock': { $lte: 5 } })
          .select('title slug basePrice variants')
          .limit(8)
          .lean(),

        Product.find({ salesCount: { $gt: 0 } })
          .sort({ salesCount: -1 })
          .limit(5)
          .select('title slug basePrice salesCount rating variants')
          .lean(),
      ]);

    const metrics = salesSummary[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
    };

    // 2. Daily Sales Trend for last 7 days
    const salesTrend = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: sevenDaysAgo },
          status: { $in: [ORDER_STATUS.PAID, ORDER_STATUS.PROCESSING, ORDER_STATUS.SHIPPED, ORDER_STATUS.DELIVERED] },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          revenue: { $sum: '$pricing.grandTotal' },
          orders: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return {
      overview: {
        totalRevenue: metrics.totalRevenue,
        totalOrders: metrics.totalOrders,
        avgOrderValue: Math.round(metrics.avgOrderValue),
        lowStockCount: lowStockProducts.length,
      },
      salesTrend,
      recentOrders,
      lowStockProducts,
      topProducts,
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

    // Restock items
    for (const item of order.items) {
      await Product.updateOne(
        { _id: item.productId, 'variants.sku': item.sku },
        { $inc: { 'variants.$.stock': item.quantity } }
      );

      await InventoryLog.create({
        productId: item.productId,
        sku: item.sku,
        changeType: 'REFUND_RESTOCK',
        previousStock: 0,
        changeQuantity: item.quantity,
        newStock: item.quantity,
        orderId: order._id,
        notes: `Refund restock for order ${order.orderNumber}`,
      });
    }

    if (payment) {
      payment.status = 'refunded';
      payment.refunds.push({
        refundId: `rfnd_${Date.now()}`,
        amount: payment.amount,
        status: 'processed',
        createdAt: new Date(),
      });
      await payment.save();
    }

    order.status = ORDER_STATUS.REFUNDED;
    order.statusHistory.push({
      status: ORDER_STATUS.REFUNDED,
      timestamp: new Date(),
      comment: reason || 'Refund issued by administrator',
      updatedBy: adminUserId ? new mongoose.Types.ObjectId(adminUserId) : undefined,
    });
    await order.save();

    if (adminUserId && adminEmail) {
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(adminUserId),
        userEmail: adminEmail,
        action: 'REFUND_ISSUED',
        resourceType: 'Order',
        resourceId: order.orderNumber,
        diff: { status: ORDER_STATUS.REFUNDED, amount: order.pricing.grandTotal },
      });
    }

    return order;
  }
}
