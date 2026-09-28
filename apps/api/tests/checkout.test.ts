import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import crypto from 'crypto';
import { createApp } from '../src/app.js';
import { Product } from '../src/modules/catalog/product.model.js';
import { Category } from '../src/modules/catalog/category.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Cart } from '../src/modules/cart/cart.model.js';
import { Order } from '../src/modules/orders/order.model.js';
import { StockReservation } from '../src/modules/orders/stock-reservation.model.js';
import { Payment } from '../src/modules/payments/payment.model.js';
import { WebhookEvent } from '../src/modules/payments/webhook-event.model.js';
import { PRODUCT_STATUS, USER_ROLES, ORDER_STATUS } from '@shopsense/shared';
import { generateAccessToken } from '../src/modules/auth/token.util.js';
import { env } from '../src/config/env.js';

describe('Checkout, Stock Reservation & Payments Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let testCategory: any;
  let testUser1: any;
  let user1Token: string;
  let testUser2: any;
  let user2Token: string;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    await Category.deleteMany({});
    await User.deleteMany({});
    await Cart.deleteMany({});
    await Order.deleteMany({});
    await StockReservation.deleteMany({});
    await Payment.deleteMany({});
    await WebhookEvent.deleteMany({});

    testCategory = await Category.create({ name: 'Gadgets', slug: 'gadgets' });

    testUser1 = await User.create({
      name: 'Buyer One',
      email: 'buyer1@test.com',
      passwordHash: 'dummyhash',
      role: USER_ROLES.CUSTOMER,
    });
    user1Token = generateAccessToken(testUser1);

    testUser2 = await User.create({
      name: 'Buyer Two',
      email: 'buyer2@test.com',
      passwordHash: 'dummyhash',
      role: USER_ROLES.CUSTOMER,
    });
    user2Token = generateAccessToken(testUser2);
  });

  it('completes order creation with atomic stock reservation in test mode', async () => {
    // 1. Create product with initial stock 10
    const product = await Product.create({
      title: 'Sony Headphones Limited Edition',
      slug: 'sony-headphones-limited',
      description: 'Exclusive limited edition',
      categoryId: testCategory._id,
      basePrice: 20000,
      status: PRODUCT_STATUS.PUBLISHED,
      variants: [
        {
          sku: 'SONY-LTD-1',
          attributes: { edition: 'Gold' },
          price: 20000,
          stock: 10,
          images: [],
        },
      ],
    });

    // 2. User 1 adds 2 units to cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        productId: product._id.toString(),
        sku: 'SONY-LTD-1',
        quantity: 2,
      });

    // 3. User 1 creates order
    const orderRes = await request(app)
      .post('/api/v1/checkout/create-order')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        shippingAddress: {
          fullName: 'Buyer One',
          addressLine1: '123 Test Street',
          city: 'Mumbai',
          postalCode: '400001',
        },
      });

    if (orderRes.status !== 201) {
      console.log('CREATE_ORDER_FAILED:', orderRes.body);
    }
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.success).toBe(true);
    expect(orderRes.body.data.order.status).toBe(ORDER_STATUS.PENDING_PAYMENT);

    // 4. Verify stock was decremented from 10 to 8
    const updatedProduct = await Product.findById(product._id);
    expect(updatedProduct?.variants[0].stock).toBe(8);

    // 5. Verify active stock reservation created
    const reservation = await StockReservation.findOne({
      orderId: orderRes.body.data.order._id,
    });
    expect(reservation).toBeDefined();
    expect(reservation?.status).toBe('active');
  });

  it('prevents overselling during concurrent checkout race condition', async () => {
    // Single remaining item in stock!
    const product = await Product.create({
      title: 'Last Remaining Rare Sneaker',
      slug: 'last-rare-sneaker',
      description: 'Only 1 left globally',
      categoryId: testCategory._id,
      basePrice: 15000,
      status: PRODUCT_STATUS.PUBLISHED,
      variants: [
        {
          sku: 'RARE-1',
          attributes: { size: '10' },
          price: 15000,
          stock: 1, // Only 1 left!
          images: [],
        },
      ],
    });

    // Both users add the single remaining item to their cart
    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ productId: product._id.toString(), sku: 'RARE-1', quantity: 1 });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user2Token}`)
      .send({ productId: product._id.toString(), sku: 'RARE-1', quantity: 1 });

    // Both attempt checkout concurrently
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/v1/checkout/create-order')
        .set('Authorization', `Bearer ${user1Token}`)
        .send({
          shippingAddress: { fullName: 'Buyer 1', addressLine1: 'Road 1', city: 'Delhi', postalCode: '110001' },
        }),
      request(app)
        .post('/api/v1/checkout/create-order')
        .set('Authorization', `Bearer ${user2Token}`)
        .send({
          shippingAddress: { fullName: 'Buyer 2', addressLine1: 'Road 2', city: 'Delhi', postalCode: '110001' },
        }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // One must succeed (201) and the other must be rejected (400)
    expect(statuses).toEqual([201, 400]);

    // Verify stock never went below 0!
    const finalProduct = await Product.findById(product._id);
    expect(finalProduct?.variants[0].stock).toBe(0);
  });

  it('verifies payment signature, transitions order to PAID and commits reservation', async () => {
    const product = await Product.create({
      title: 'Coffee Machine',
      slug: 'coffee-machine',
      description: 'Espresso Maker',
      categoryId: testCategory._id,
      basePrice: 5000,
      status: PRODUCT_STATUS.PUBLISHED,
      variants: [{ sku: 'COFFEE-1', price: 5000, stock: 5, images: [] }],
    });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ productId: product._id.toString(), sku: 'COFFEE-1', quantity: 1 });

    const orderRes = await request(app)
      .post('/api/v1/checkout/create-order')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        shippingAddress: { fullName: 'Buyer', addressLine1: 'Street', city: 'Pune', postalCode: '411001' },
      });

    const orderId = orderRes.body.data.order._id;
    const rzpOrderId = orderRes.body.data.razorpayOrder.id;
    const rzpPaymentId = 'pay_test_123456';

    // Compute HMAC signature using configured secret
    const secret = env.RAZORPAY_KEY_SECRET || 'placeholder_secret';
    const signature = crypto
      .createHmac('sha256', secret)
      .update(`${rzpOrderId}|${rzpPaymentId}`)
      .digest('hex');

    // Confirm payment
    const verifyRes = await request(app)
      .post('/api/v1/payments/verify')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({
        razorpayOrderId: rzpOrderId,
        razorpayPaymentId: rzpPaymentId,
        razorpaySignature: signature,
      });

    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.data.order.status).toBe(ORDER_STATUS.PAID);

    // Verify stock reservation committed
    const reservation = await StockReservation.findOne({ orderId });
    expect(reservation?.status).toBe('committed');
  });

  it('verifies webhook signatures against raw bytes and processes duplicate event IDs once', async () => {
    const product = await Product.create({
      title: 'Webhook Test Speaker',
      slug: 'webhook-test-speaker',
      description: 'Speaker used for webhook integration coverage',
      categoryId: testCategory._id,
      basePrice: 4000,
      status: PRODUCT_STATUS.PUBLISHED,
      variants: [{ sku: 'WEBHOOK-1', price: 4000, stock: 2, images: [] }],
    });

    await request(app)
      .post('/api/v1/cart/items')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ productId: product._id.toString(), sku: 'WEBHOOK-1', quantity: 1 });

    const orderRes = await request(app)
      .post('/api/v1/checkout/create-order')
      .set('Authorization', `Bearer ${user1Token}`)
      .send({ shippingAddress: { fullName: 'Buyer', addressLine1: 'Street', city: 'Pune', postalCode: '411001' } });
    const razorpayOrderId = orderRes.body.data.razorpayOrder.id;
    const eventId = 'evt_webhook_raw_signature';
    const rawBody = JSON.stringify(
      {
        event: 'payment.captured',
        payload: { payment: { entity: { id: 'pay_webhook_1', order_id: razorpayOrderId } } },
      },
      null,
      2
    );
    const signature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_webhook_secret')
      .update(rawBody)
      .digest('hex');

    const sendWebhook = () =>
      request(app)
        .post('/api/v1/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('x-razorpay-signature', signature)
        .set('x-razorpay-event-id', eventId)
        .send(rawBody);

    const firstDelivery = await sendWebhook();
    expect(firstDelivery.status).toBe(200);
    expect(firstDelivery.body.data.status).toBe('processed');
    expect((await Order.findById(orderRes.body.data.order._id))?.status).toBe(ORDER_STATUS.PAID);

    const duplicateDelivery = await sendWebhook();
    expect(duplicateDelivery.status).toBe(200);
    expect(duplicateDelivery.body.data.status).toBe('already_processed');
    expect(await WebhookEvent.countDocuments({ eventId })).toBe(1);
  });
});
