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
import { Coupon } from '../coupons/coupon.model.js';
import { OrderService } from '../orders/order.service.js';
import { InvoiceService } from '../orders/invoice.service.js';

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
        const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { orderNumber: { $regex: pattern, $options: 'i' } },
          { 'shippingAddress.fullName': { $regex: pattern, $options: 'i' } },
          { 'shippingAddress.city': { $regex: pattern, $options: 'i' } },
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
      const id = String(req.params.id);
      const { status, trackingNumber, carrier, comment } = req.body;

      if (!status || !Object.values(ORDER_STATUS).includes(status)) {
        throw AppError.badRequest('Invalid order status');
      }

      const order = await Order.findById(id);
      if (!order) throw AppError.notFound('Order not found');
      const prevStatus = order.status;
      const transitioned = await OrderService.transitionStatus(
        id,
        status,
        comment || `Status updated from ${prevStatus} to ${status} by admin`,
        req.user?._id.toString()
      );

      if (!transitioned.fulfillment) {
        transitioned.fulfillment = {};
      }

      if (trackingNumber) transitioned.fulfillment.trackingNumber = trackingNumber;
      if (carrier) transitioned.fulfillment.carrier = carrier;

      if (status === ORDER_STATUS.SHIPPED && !transitioned.fulfillment.shippedAt) {
        transitioned.fulfillment.shippedAt = new Date();
      } else if (status === ORDER_STATUS.DELIVERED && !transitioned.fulfillment.deliveredAt) {
        transitioned.fulfillment.deliveredAt = new Date();
      }

      await transitioned.save();

      // Audit Log
      await AuditLog.create({
        userId: req.user?._id,
        userEmail: req.user?.email || 'admin@shopsense.ai',
        action: 'ORDER_STATUS_UPDATE',
        resourceType: 'Order',
        resourceId: transitioned.orderNumber,
        diff: { before: { status: prevStatus }, after: { status } },
      });

      res.json({ success: true, data: transitioned });
    } catch (err) {
      next(err);
    }
  }

  static async refundOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const { reason } = req.body;
      const order = await AdminService.processRefund(
        id,
        reason,
        req.user?._id.toString(),
        req.user?.email
      );
      res.json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  static async downloadInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const order = await Order.findById(String(req.params.id));
      if (!order) throw AppError.notFound('Order not found');
      if (order.status === ORDER_STATUS.PENDING_PAYMENT || order.status === ORDER_STATUS.CANCELLED) {
        throw AppError.conflict('Invoice is available after payment is confirmed');
      }

      const buyer = await User.findById(order.userId).select('email').lean();
      const pdf = await InvoiceService.generate(order, buyer?.email);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-invoice.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      res.status(200).send(pdf);
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
        userId: req.user?._id,
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
      const id = String(req.params.id);
      const product = await Product.findByIdAndUpdate(id, req.body, { new: true });
      if (!product) throw AppError.notFound('Product not found');

      await invalidateCatalogCache();

      await AuditLog.create({
        userId: req.user?._id,
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

  static async deleteProduct(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const product = await Product.findByIdAndUpdate(
        id,
        { $set: { status: 'archived' } },
        { new: true, runValidators: true }
      );
      if (!product) throw AppError.notFound('Product not found');
      await invalidateCatalogCache();
      await AuditLog.create({
        userId: req.user?._id,
        userEmail: req.user?.email || 'admin',
        action: 'PRODUCT_ARCHIVED',
        resourceType: 'Product',
        resourceId: product.slug,
        diff: { after: { status: product.status } },
      });
      res.json({ success: true, data: product });
    } catch (err) {
      next(err);
    }
  }

  static async getLowStock(req: Request, res: Response, next: NextFunction) {
    try {
      const threshold = Math.min(1000, Math.max(0, Number(req.query.threshold) || 5));
      const data = await AdminService.getLowStock(threshold);
      res.json({ success: true, data, threshold });
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
        adminUserId: req.user!._id.toString(),
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
      const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';

      const query: Record<string, any> = { role: 'customer' };
      if (search) {
        const pattern = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        query.$or = [
          { name: { $regex: pattern, $options: 'i' } },
          { email: { $regex: pattern, $options: 'i' } },
        ];
      }

      const customers = await User.find(query)
        .select('-passwordHash -refreshTokens -verificationToken -resetPasswordToken')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();

      const total = await User.countDocuments(query);

      res.json({
        success: true,
        data: customers,
        pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      });
    } catch (err) {
      next(err);
    }
  }

  static async setCustomerBlocked(req: Request, res: Response, next: NextFunction) {
    try {
      const id = String(req.params.id);
      const isBlocked = req.body.isBlocked;
      if (typeof isBlocked !== 'boolean') throw AppError.badRequest('isBlocked must be a boolean');
      const customer = await User.findOneAndUpdate(
        { _id: id, role: 'customer' },
        { $set: { isBlocked } },
        { new: true }
      ).select('-passwordHash -refreshTokens -verificationToken -resetPasswordToken');
      if (!customer) throw AppError.notFound('Customer not found');
      await AuditLog.create({
        userId: req.user?._id,
        userEmail: req.user?.email || 'admin',
        action: isBlocked ? 'CUSTOMER_BLOCKED' : 'CUSTOMER_UNBLOCKED',
        resourceType: 'User',
        resourceId: customer.email,
        diff: { after: { isBlocked } },
      });
      res.json({ success: true, data: customer });
    } catch (err) {
      next(err);
    }
  }

  static async getCoupons(_req: Request, res: Response, next: NextFunction) {
    try {
      const coupons = await Coupon.find().sort({ createdAt: -1 }).lean();
      res.json({ success: true, data: coupons });
    } catch (err) {
      next(err);
    }
  }

  static async createCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const coupon = await Coupon.create(req.body);
      await AuditLog.create({
        userId: req.user?._id,
        userEmail: req.user?.email || 'admin',
        action: 'COUPON_CREATED',
        resourceType: 'Coupon',
        resourceId: coupon.code,
        diff: { after: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue } },
      });
      res.status(201).json({ success: true, data: coupon });
    } catch (err) {
      next(err);
    }
  }

  static async updateCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const coupon = await Coupon.findByIdAndUpdate(String(req.params.id), req.body, {
        new: true,
        runValidators: true,
      });
      if (!coupon) throw AppError.notFound('Coupon not found');
      await AuditLog.create({
        userId: req.user?._id,
        userEmail: req.user?.email || 'admin',
        action: 'COUPON_UPDATED',
        resourceType: 'Coupon',
        resourceId: coupon.code,
        diff: { after: { isActive: coupon.isActive, endDate: coupon.endDate } },
      });
      res.json({ success: true, data: coupon });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCoupon(req: Request, res: Response, next: NextFunction) {
    try {
      const coupon = await Coupon.findByIdAndDelete(String(req.params.id));
      if (!coupon) throw AppError.notFound('Coupon not found');
      await AuditLog.create({
        userId: req.user?._id,
        userEmail: req.user?.email || 'admin',
        action: 'COUPON_DELETED',
        resourceType: 'Coupon',
        resourceId: coupon.code,
        diff: { before: { code: coupon.code } },
      });
      res.json({ success: true, data: { id: coupon._id } });
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
      const logs = await InventoryLog.find()
        .populate('productId', 'title slug')
        .populate('performedBy', 'name email')
        .sort({ createdAt: -1 })
        .limit(100)
        .lean();
      res.json({ success: true, data: logs });
    } catch (err) {
      next(err);
    }
  }
}
