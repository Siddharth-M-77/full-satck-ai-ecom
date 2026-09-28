import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Product } from '../src/modules/catalog/product.model.js';
import { Category } from '../src/modules/catalog/category.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Order } from '../src/modules/orders/order.model.js';
import { AuditLog } from '../src/modules/admin/audit-log.model.js';
import { InventoryLog } from '../src/modules/admin/inventory-log.model.js';
import { Payment } from '../src/modules/payments/payment.model.js';
import { PRODUCT_STATUS, USER_ROLES, ORDER_STATUS } from '@shopsense/shared';
import { generateAccessToken } from '../src/modules/auth/token.util.js';

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
    await User.deleteMany({});
    await Order.deleteMany({});
    await Payment.deleteMany({});
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
    expect(res.body.data.recentOrders).toHaveLength(1);
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
      status: ORDER_STATUS.PAID,
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
