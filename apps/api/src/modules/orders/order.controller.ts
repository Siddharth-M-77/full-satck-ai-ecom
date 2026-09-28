import { Request, Response, NextFunction } from 'express';
import { OrderService } from './order.service.js';
import { PaymentService } from '../payments/payment.service.js';
import { Order } from './order.model.js';
import { AppError } from '../../utils/app-error.js';

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
      const result = await PaymentService.confirmPayment(req.body);
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
      const rawBody = JSON.stringify(req.body);

      const result = await PaymentService.processWebhook(rawBody, signature || '');
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
}
