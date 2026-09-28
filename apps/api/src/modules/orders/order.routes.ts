import { Router } from 'express';
import { OrderController } from './order.controller.js';
import { authenticate } from '../../middlewares/auth.middleware.js';

const router = Router();

// Order creation & Checkout (Auth required)
router.post('/checkout/create-order', authenticate, OrderController.createOrder);

// Payment verification (Auth required)
router.post('/payments/verify', authenticate, OrderController.verifyPayment);

// Payment Webhook (Public, signature verified)
router.post('/payments/webhook', OrderController.handleWebhook);

// Customer order tracking & history (Auth required)
router.get('/orders', authenticate, OrderController.getOrders);
router.get('/orders/:id/invoice', authenticate, OrderController.downloadInvoice);
router.get('/orders/:id', authenticate, OrderController.getOrderById);

export const orderRouter = router;
