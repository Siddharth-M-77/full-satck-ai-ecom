import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service.js';
import { PaymentService } from '../payments/payment.service.js';
import { Order } from './order.model.js';
import { AppError } from '../../utils/app-error.js';
import { InvoiceService } from './invoice.service.js';
import { ORDER_STATUS } from '@shopsense/shared';

export class OrderController {
  static async createOrder(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!._id.toString();
      const result = await OrderService.createOrder(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Order created successfully. Ready for payment.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async verifyPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await PaymentService.confirmPayment({
        ...req.body,
        userId: req.user!._id.toString(),
      });
      res.status(200).json({
        success: true,
        message: 'Payment verified and order confirmed.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  static async handleWebhook(req: Request, res: Response, next: NextFunction) {
    try {
      const signature = req.headers['x-razorpay-signature'] as string;
      const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : '';
      const eventId = req.headers['x-razorpay-event-id'] as string | undefined;

      const result = await PaymentService.processWebhook(rawBody, signature || '', eventId);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }

  static async getOrders(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!._id;
      const orders = await Order.find({ userId }).sort({ createdAt: -1 });
      res.status(200).json({ success: true, data: orders });
    } catch (err) {
      next(err);
    }
  }

  static async getOrderById(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user!._id;
      const orderId = req.params.id as string;

      const order = await Order.findOne({ _id: orderId, userId });
      if (!order) throw AppError.notFound('Order not found');

      res.status(200).json({ success: true, data: order });
    } catch (err) {
      next(err);
    }
  }

  static async downloadInvoice(req: Request, res: Response, next: NextFunction) {
    try {
      const orderId = String(req.params.id);
      const order = await Order.findOne({ _id: orderId, userId: req.user!._id });
      if (!order) throw AppError.notFound('Order not found');

      const invoiceReadyStatuses = new Set<string>([
        ORDER_STATUS.PAID,
        ORDER_STATUS.PROCESSING,
        ORDER_STATUS.SHIPPED,
        ORDER_STATUS.DELIVERED,
        ORDER_STATUS.REFUND_REQUESTED,
        ORDER_STATUS.REFUNDED,
      ]);
      if (!invoiceReadyStatuses.has(order.status)) {
        throw AppError.conflict('Invoice is available after payment is confirmed');
      }

      const pdf = await InvoiceService.generate(order, req.user?.email);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${order.orderNumber}-invoice.pdf"`);
      res.setHeader('Content-Length', pdf.length);
      res.status(200).send(pdf);
    } catch (err) {
      next(err);
    }
  }
}
