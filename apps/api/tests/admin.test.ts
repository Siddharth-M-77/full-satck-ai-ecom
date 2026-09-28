import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Product } from '../src/modules/catalog/product.model.js';
import { Category } from '../src/modules/catalog/category.model.js';
import { Brand } from '../src/modules/catalog/brand.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Order } from '../src/modules/orders/order.model.js';
import { AuditLog } from '../src/modules/admin/audit-log.model.js';
import { InventoryLog } from '../src/modules/admin/inventory-log.model.js';
import { Payment } from '../src/modules/payments/payment.model.js';
import { Coupon } from '../src/modules/coupons/coupon.model.js';
import { PRODUCT_STATUS, USER_ROLES, ORDER_STATUS } from '@shopsense/shared';
import { generateAccessToken } from '../src/modules/auth/token.util.js';
import crypto from 'crypto';
import { env } from '../src/config/env.js';

describe('Admin Panel, Analytics & Inventory Logs Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let adminUser: any;
  let adminToken: string;
  let customerUser: any;
  let customerToken: string;
  let testProduct: any;
  let testCategory: any;

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
    await Brand.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});
    await Payment.deleteMany({});
    await Coupon.deleteMany({});
    await AuditLog.deleteMany({});
    await InventoryLog.deleteMany({});

    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@shopsense.ai',
      passwordHash: 'dummyhash',
      role: USER_ROLES.ADMIN,
    });
    adminToken = generateAccessToken(adminUser);

    customerUser = await User.create({
      name: 'John Customer',
      email: 'john@gmail.com',
      passwordHash: 'dummyhash',
      role: USER_ROLES.CUSTOMER,
    });
    customerToken = generateAccessToken(customerUser);

    testCategory = await Category.create({ name: 'Audio', slug: 'audio' });

    testProduct = await Product.create({
      title: 'Noise Cancelling Headphones',
      slug: 'noise-cancelling-headphones',
      description: 'Active noise cancelling premium headphones',
      categoryId: testCategory._id,
      basePrice: 19999,
      status: PRODUCT_STATUS.ACTIVE,
      variants: [
        {
          sku: 'NC-BLK-01',
          title: 'Matte Black',
          attributes: { Color: 'Black' },
          price: 19999,
          stock: 15,
        },
      ],
    });
  });

  it('rejects unauthenticated requests to admin dashboard with 401', async () => {
    const res = await request(app).get('/api/v1/admin/dashboard');
    expect(res.status).toBe(401);
  });

  it('rejects customer role requests to admin endpoints with 403', async () => {
    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  it('allows admin to fetch dashboard metrics successfully', async () => {
    // Create a mock completed order
    await Order.create({
      orderNumber: 'ORD-TEST-100',
      userId: customerUser._id,
      customer: {
        name: customerUser.name,
        email: customerUser.email,
        phone: '9876543210',
      },
      shippingAddress: {
        street: '123 Tech Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      items: [
        {
          productId: testProduct._id,
          sku: 'NC-BLK-01',
          title: testProduct.title,
          unitPrice: 19999,
          quantity: 1,
          subtotal: 19999,
        },
      ],
      pricing: {
        itemsTotal: 19999,
        subtotal: 19999,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 0,
        grandTotal: 19999,
      },
      status: ORDER_STATUS.PAID,
    });

    const res = await request(app)
      .get('/api/v1/admin/dashboard')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.overview.totalRevenue).toBe(19999);
    expect(res.body.data.overview.totalOrders).toBe(1);
    expect(res.body.data.salesPeriods.today).toMatchObject({ revenue: 19999, orders: 1 });
    expect(res.body.data.salesPeriods.last7Days).toMatchObject({ revenue: 19999, orders: 1 });
    expect(res.body.data.salesPeriods.last30Days).toMatchObject({ revenue: 19999, orders: 1 });
    expect(res.body.data.inventory).toEqual(expect.arrayContaining([
      expect.objectContaining({
        productId: testProduct._id.toString(),
        sku: 'NC-BLK-01',
        stock: 15,
      }),
    ]));
    expect(res.body.data.recentOrders).toHaveLength(1);
    expect(res.body.data.salesTrend).toHaveLength(30);
    expect(res.body.data.previousSalesPeriods.today).toMatchObject({ revenue: 0, orders: 0 });
    expect(res.body.data.orderStatusBreakdown).toEqual([{ status: ORDER_STATUS.PAID, count: 1 }]);
    expect(res.body.data.revenueByCategory).toEqual([{ name: 'Audio', revenue: 19999, units: 1 }]);
    expect(res.body.data.customers).toEqual({ total: 1, newLast30Days: 1, blocked: 0 });
    expect(res.body.data.stockHealth).toEqual({ healthy: 1, low: 0, out: 0 });
  });

  it('lets admins download an invoice for any paid order', async () => {
    const order = await Order.create({
      orderNumber: 'ORD-INVOICE-ADMIN',
      userId: customerUser._id,
      shippingAddress: { fullName: customerUser.name, city: 'Bengaluru', postalCode: '560001' },
      items: [{ productId: testProduct._id, sku: 'NC-BLK-01', title: testProduct.title, unitPrice: 19999, quantity: 1, subtotal: 19999 }],
      pricing: { itemsTotal: 19999, discountTotal: 0, shippingFee: 0, taxTotal: 0, grandTotal: 19999 },
      status: ORDER_STATUS.PAID,
    });

    const res = await request(app)
      .get(`/api/v1/admin/orders/${order._id}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('application/pdf');

    await Order.updateOne({ _id: order._id }, { status: ORDER_STATUS.PENDING_PAYMENT });
    const pending = await request(app)
      .get(`/api/v1/admin/orders/${order._id}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pending.status).toBe(409);
  });

  it('searches customers by name or email', async () => {
    await User.create({ name: 'Priya Sharma', email: 'priya@example.com', passwordHash: 'dummyhash', role: USER_ROLES.CUSTOMER });

    const res = await request(app)
      .get('/api/v1/admin/customers?search=priya')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].email).toBe('priya@example.com');
    expect(res.body.pagination.total).toBe(1);
  });

  it('allows admin to adjust variant stock and logs inventory and audit records', async () => {
    const adjustRes = await request(app)
      .post('/api/v1/admin/inventory/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: testProduct._id.toString(),
        sku: 'NC-BLK-01',
        changeQuantity: 10,
        notes: 'Warehouse batch shipment restock',
      });

    expect(adjustRes.status).toBe(200);
    expect(adjustRes.body.success).toBe(true);
    expect(adjustRes.body.data.newStock).toBe(25);

    // Verify DB update
    const updated = await Product.findById(testProduct._id);
    expect(updated?.variants[0].stock).toBe(25);

    // Verify InventoryLog
    const invLogs = await InventoryLog.find({ sku: 'NC-BLK-01' });
    expect(invLogs).toHaveLength(1);
    expect(invLogs[0].changeType).toBe('RESTOCK');
    expect(invLogs[0].changeQuantity).toBe(10);

    // Verify AuditLog
    const auditLogs = await AuditLog.find({ action: 'STOCK_ADJUSTMENT' });
    expect(auditLogs).toHaveLength(1);
    expect(auditLogs[0].userEmail).toBe(adminUser.email);
  });

  it('lists low-stock variants using the requested threshold', async () => {
    const response = await request(app)
      .get('/api/v1/admin/inventory/low-stock?threshold=15')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ sku: 'NC-BLK-01', stock: 15, threshold: 15 }),
    ]));
  });

  it('archives a product through the admin product endpoint', async () => {
    const response = await request(app)
      .delete(`/api/v1/admin/products/${testProduct._id}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(PRODUCT_STATUS.ARCHIVED);
    expect((await Product.findById(testProduct._id))?.status).toBe(PRODUCT_STATUS.ARCHIVED);
  });

  it('blocks and unblocks customer accounts with audit records', async () => {
    const blocked = await request(app)
      .patch(`/api/v1/admin/customers/${customerUser._id}/block`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBlocked: true });

    expect(blocked.status).toBe(200);
    expect(blocked.body.data.isBlocked).toBe(true);

    const unblocked = await request(app)
      .patch(`/api/v1/admin/customers/${customerUser._id}/block`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isBlocked: false });

    expect(unblocked.status).toBe(200);
    expect(unblocked.body.data.isBlocked).toBe(false);
    expect(await AuditLog.countDocuments({ action: { $in: ['CUSTOMER_BLOCKED', 'CUSTOMER_UNBLOCKED'] } })).toBe(2);
  });

  it('supports coupon create, update and delete from admin routes', async () => {
    const created = await request(app)
      .post('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: 'SAVE10',
        discountType: 'percentage',
        discountValue: 10,
        minOrderValue: 500,
        startDate: new Date(),
        endDate: new Date(Date.now() + 86400000),
      });

    expect(created.status).toBe(201);
    const couponId = created.body.data._id;

    const updated = await request(app)
      .put(`/api/v1/admin/coupons/${couponId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ isActive: false });
    expect(updated.status).toBe(200);
    expect(updated.body.data.isActive).toBe(false);

    const listed = await request(app)
      .get('/api/v1/admin/coupons')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(listed.body.data).toHaveLength(1);

    const deleted = await request(app)
      .delete(`/api/v1/admin/coupons/${couponId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleted.status).toBe(200);
    expect(await Coupon.countDocuments()).toBe(0);
  });

  it('restocks inventory only after a processed Razorpay refund and ignores webhook retries', async () => {
    const order = await Order.create({
      orderNumber: 'ORD-REFUND-TEST',
      userId: customerUser._id,
      shippingAddress: { fullName: customerUser.name, city: 'Bengaluru', postalCode: '560001' },
      items: [{
        productId: testProduct._id,
        sku: 'NC-BLK-01',
        title: testProduct.title,
        variantAttributes: { Color: 'Black' },
        unitPrice: 19999,
        quantity: 2,
        subtotal: 39998,
      }],
      pricing: { itemsTotal: 39998, discountTotal: 0, shippingFee: 0, taxTotal: 0, grandTotal: 39998 },
      status: ORDER_STATUS.PAID,
    });
    await Payment.create({
      orderId: order._id,
      razorpayOrderId: 'order_refund_test',
      razorpayPaymentId: 'pay_refund_test',
      amount: 3999800,
      currency: 'INR',
      status: 'captured',
      refunds: [],
      rawWebhookPayloads: [],
    });

    const response = await request(app)
      .post(`/api/v1/admin/orders/${order._id}/refund`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Refund test' });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(ORDER_STATUS.REFUNDED);
    expect((await Product.findById(testProduct._id))?.variants[0].stock).toBe(17);
    const payment = await Payment.findOne({ orderId: order._id });
    expect(payment?.refunds[0].status).toBe('processed');

    const rawBody = JSON.stringify({
      event: 'refund.processed',
      payload: { refund: { entity: { id: payment?.refunds[0].refundId, payment_id: payment?.razorpayPaymentId } } },
    });
    const signature = crypto
      .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET || 'placeholder_webhook_secret')
      .update(rawBody)
      .digest('hex');
    const firstWebhook = await request(app)
      .post('/api/v1/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', signature)
      .set('x-razorpay-event-id', 'evt_refund_already_processed')
      .send(rawBody);
    expect(firstWebhook.status).toBe(200);
    expect((await Product.findById(testProduct._id))?.variants[0].stock).toBe(17);
  });

  it('keeps refunds, deletes, blocking and audit logs admin-only while staff can operate', async () => {
    const staffUser = await User.create({ name: 'Store Staff', email: 'staff@shopsense.ai', passwordHash: 'dummyhash', role: USER_ROLES.STAFF });
    const auth = { Authorization: `Bearer ${generateAccessToken(staffUser)}` };

    expect((await request(app).get('/api/v1/admin/orders').set(auth)).status).toBe(200);
    expect((await request(app).get('/api/v1/admin/products').set(auth)).status).toBe(200);
    expect((await request(app).delete(`/api/v1/admin/products/${testProduct._id}`).set(auth)).status).toBe(403);
    expect((await request(app).patch(`/api/v1/admin/customers/${customerUser._id}/block`).set(auth).send({ isBlocked: true })).status).toBe(403);
    expect((await request(app).get('/api/v1/admin/audit-logs').set(auth)).status).toBe(403);
    expect((await request(app).delete(`/api/v1/admin/categories/${testCategory._id}`).set(auth)).status).toBe(403);
  });

  it('manages categories and refuses to delete one that still has products', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const created = await request(app).post('/api/v1/admin/categories').set(auth).send({ name: 'Smart Home' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('smart-home');

    const listed = await request(app).get('/api/v1/admin/categories').set(auth);
    expect(listed.body.data).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Audio', productCount: 1 }),
      expect.objectContaining({ name: 'Smart Home', productCount: 0 }),
    ]));

    const updated = await request(app).put(`/api/v1/admin/categories/${created.body.data._id}`).set(auth).send({ isActive: false });
    expect(updated.body.data.isActive).toBe(false);

    expect((await request(app).delete(`/api/v1/admin/categories/${testCategory._id}`).set(auth)).status).toBe(409);
    expect((await request(app).delete(`/api/v1/admin/categories/${created.body.data._id}`).set(auth)).status).toBe(200);
  });

  it('manages brands', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const created = await request(app).post('/api/v1/admin/brands').set(auth).send({ name: 'Sony Audio' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('sony-audio');
    expect((await request(app).delete(`/api/v1/admin/brands/${created.body.data._id}`).set(auth)).status).toBe(200);
    expect(await Brand.countDocuments()).toBe(0);
  });

  it('returns order detail with customer and payment but without raw webhook payloads', async () => {
    const order = await Order.create({
      orderNumber: 'ORD-DETAIL-TEST',
      userId: customerUser._id,
      shippingAddress: { fullName: customerUser.name, city: 'Pune', postalCode: '411001' },
      items: [{ productId: testProduct._id, sku: 'NC-BLK-01', title: testProduct.title, unitPrice: 19999, quantity: 1, subtotal: 19999 }],
      pricing: { itemsTotal: 19999, discountTotal: 0, shippingFee: 0, taxTotal: 0, grandTotal: 19999 },
      status: ORDER_STATUS.PAID,
      statusHistory: [{ status: ORDER_STATUS.PAID, comment: 'Payment captured' }],
    });
    await Payment.create({
      orderId: order._id, razorpayOrderId: 'order_detail', razorpayPaymentId: 'pay_detail',
      amount: 1999900, status: 'captured', refunds: [], rawWebhookPayloads: [{ event: 'payment.captured' }],
    });

    const res = await request(app).get(`/api/v1/admin/orders/${order._id}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.customer.email).toBe(customerUser.email);
    expect(res.body.data.payment.razorpayPaymentId).toBe('pay_detail');
    expect(res.body.data.payment.rawWebhookPayloads).toBeUndefined();
    expect(res.body.data.statusHistory).toHaveLength(1);
  });

  it('coupon updates only touch the fields sent and never usedCount', async () => {
    const auth = { Authorization: `Bearer ${adminToken}` };
    const startDate = new Date(Date.now() - 86400000);
    const coupon = await Coupon.create({
      code: 'KEEP5', discountType: 'flat', discountValue: 50, startDate,
      endDate: new Date(Date.now() + 86400000 * 10), usageLimitPerUser: 3, isActive: false, usedCount: 7,
    });

    const res = await request(app).put(`/api/v1/admin/coupons/${coupon._id}`).set(auth).send({ discountValue: 75, usedCount: 0 });
    expect(res.status).toBe(200);
    const saved = await Coupon.findById(coupon._id);
    expect(saved?.discountValue).toBe(75);
    expect(saved?.isActive).toBe(false);
    expect(saved?.usageLimitPerUser).toBe(3);
    expect(saved?.usedCount).toBe(7);
    expect(saved?.startDate.getTime()).toBe(startDate.getTime());

    const invalid = await request(app).put(`/api/v1/admin/coupons/${coupon._id}`).set(auth).send({ endDate: new Date(startDate.getTime() - 1000) });
    expect(invalid.status).toBe(400);
  });

  it('allows admin to update order status and records audit history', async () => {
    const order = await Order.create({
      orderNumber: 'ORD-STATUS-TEST',
      userId: customerUser._id,
      customer: {
        name: customerUser.name,
        email: customerUser.email,
        phone: '9876543210',
      },
      shippingAddress: {
        street: '123 Tech Park',
        city: 'Bengaluru',
        state: 'Karnataka',
        postalCode: '560001',
        country: 'India',
      },
      items: [
        {
          productId: testProduct._id,
          sku: 'NC-BLK-01',
          title: testProduct.title,
          unitPrice: 19999,
          quantity: 1,
          subtotal: 19999,
        },
      ],
      pricing: {
        itemsTotal: 19999,
        subtotal: 19999,
        discountTotal: 0,
        shippingTotal: 0,
        taxTotal: 0,
        grandTotal: 19999,
      },
      status: ORDER_STATUS.PROCESSING,
    });

    const updateRes = await request(app)
      .patch(`/api/v1/admin/orders/${order._id}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: ORDER_STATUS.SHIPPED,
        carrier: 'BlueDart Express',
        trackingNumber: 'BD-99887766',
        comment: 'Dispatched from central warehouse',
      });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.status).toBe(ORDER_STATUS.SHIPPED);
    expect(updateRes.body.data.fulfillment.trackingNumber).toBe('BD-99887766');

    const auditLog = await AuditLog.findOne({ action: 'ORDER_STATUS_UPDATE' });
    expect(auditLog).toBeDefined();
    expect(auditLog?.diff.after.status).toBe(ORDER_STATUS.SHIPPED);
  });
});
