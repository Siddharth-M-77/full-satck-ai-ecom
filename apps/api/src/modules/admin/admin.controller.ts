import { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import { AdminService } from './admin.service.js';
import { Order } from '../orders/order.model.js';
import { Product } from '../catalog/product.model.js';
import { User } from '../users/user.model.js';
import { AuditLog } from './audit-log.model.js';
import { InventoryLog } from './inventory-log.model.js';
import { AppError } from '../../utils/app-error.js';
import { invalidateCatalogCache } from '../catalog/cache.util.js';
import { ORDER_STATUS } from '@shopsense/shared';

export class AdminController {
  static async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const data = await AdminService.getDashboardAnalytics();
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }

  static async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const status = req.query.status as string;
      const search = req.query.search as string;

      const query: Record<string, any> = {};
      if (status) query.status = status;
      if (search) {
        query.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          { 'customer.email': { $regex: search, $options: 'i' } },
          { 'customer.name': { $regex: search, $options: 'i' } },
        ];
      }

      const total = await Order.countDocuments(query);
      const orders = await Order.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: orders,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateOrderStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { status, trackingNumber, carrier, comment } = req.body;

      if (!status || !Object.values(ORDER_STATUS).includes(status)) {
        throw AppError.badRequest('Invalid order status');
      }

      const order = await Order.findById(id);
      if (!order) throw AppError.notFound('Order not found');

      const prevStatus = order.status;
      order.status = status;

      if (!order.fulfillment) {
        order.fulfillment = {};
      }

      if (trackingNumber) order.fulfillment.trackingNumber = trackingNumber;
      if (carrier) order.fulfillment.carrier = carrier;

      if (status === ORDER_STATUS.SHIPPED && !order.fulfillment.shippedAt) {
        order.fulfillment.shippedAt = new Date();
      } else if (status === ORDER_STATUS.DELIVERED && !order.fulfillment.deliveredAt) {
        order.fulfillment.deliveredAt = new Date();
      }

      order.statusHistory.push({
        status,
        timestamp: new Date(),
        comment: comment || `Status updated from ${prevStatus} to ${status} by admin`,
        updatedBy: req.user ? new mongoose.Types.ObjectId(req.user.userId) : undefined,
      });

      await order.save();

      // Audit Log
      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(req.user?.userId),
        userEmail: req.user?.email || 'admin@shopsense.ai',
        action: 'ORDER_STATUS_UPDATE',
        resourceType: 'Order',
        resourceId: order.orderNumber,
        diff: { before: { status: prevStatus }, after: { status } },
      });

      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  static async refundOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const order = await AdminService.processRefund(
        id,
        reason,
        req.user?.userId,
        req.user?.email
      );
      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  static async getProducts(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;
      const search = req.query.search as string;

      const query: Record<string, any> = {};
      if (search) {
        query.$or = [
          { title: { $regex: search, $options: 'i' } },
          { 'variants.sku': { $regex: search, $options: 'i' } },
        ];
      }

      const total = await Product.countDocuments(query);
      const products = await Product.find(query)
        .populate('categoryId', 'name slug')
        .populate('brandId', 'name slug')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      res.json({
        success: true,
        data: products,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (err) {
      next(err);
    }
  }

  static async createProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const product = await Product.create(req.body);
      await invalidateCatalogCache();

      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(req.user?.userId),
        userEmail: req.user?.email || 'admin@shopsense.ai',
        action: 'PRODUCT_CREATED',
        resourceType: 'Product',
        resourceId: product.slug,
        diff: { after: { id: product._id, title: product.title } },
      });

      res.status(201).json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }

  static async updateProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const product = await Product.findByIdAndUpdate(id, req.body, { new: true });
      if (!product) throw AppError.notFound('Product not found');

      await invalidateCatalogCache();

      await AuditLog.create({
        userId: new mongoose.Types.ObjectId(req.user?.userId),
        userEmail: req.user?.email || 'admin@shopsense.ai',
        action: 'PRODUCT_UPDATED',
        resourceType: 'Product',
        resourceId: product.slug,
        diff: { after: { id: product._id, title: product.title } },
      });

      res.json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }

  static async adjustStock(req: Request, res: Response, next: NextFunction) {
    try {
      const { productId, sku, changeQuantity, notes } = req.body;
      if (!productId || !sku || typeof changeQuantity !== 'number') {
        throw AppError.badRequest('productId, sku, and numeric changeQuantity are required');
      }

      const result = await AdminService.adjustStock({
        productId,
        sku,
        changeQuantity,
        notes,
        adminUserId: req.user!.userId,
        adminEmail: req.user!.email,
      });

      await invalidateCatalogCache();
      res.json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getCustomers(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string, 10) || 1;
      const limit = parseInt(req.query.limit as string, 10) || 20;

      const customers = await User.find({ roles: 'customer' })
        .select('-passwordHash')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await User.countDocuments({ roles: 'customer' });

      res.json({
        success: true,
        data: customers,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogs(_req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(50).lean();
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }

  static async getInventoryLogs(_req: Request, res: Response, next: NextFunction) {
    try {
      const logs = await InventoryLog.find().sort({ createdAt: -1 }).limit(50).lean();
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
}
