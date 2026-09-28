import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Product } from '../src/modules/catalog/product.model.js';
import { Category } from '../src/modules/catalog/category.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Cart } from '../src/modules/cart/cart.model.js';
import { Order } from '../src/modules/orders/order.model.js';
import { Coupon } from '../src/modules/coupons/coupon.model.js';
import { StockReservation } from '../src/modules/orders/stock-reservation.model.js';
import { Payment } from '../src/modules/payments/payment.model.js';
import { OrderService } from '../src/modules/orders/order.service.js';
import { PRODUCT_STATUS, USER_ROLES, ORDER_STATUS } from '@shopsense/shared';
import { generateAccessToken } from '../src/modules/auth/token.util.js';

describe('Coupons at cart and checkout', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();
  let token: string;
  let product: any;

  const day = 86400000;
  const address = { fullName: 'Coupon Buyer', addressLine1: '1 MG Road', city: 'Pune', postalCode: '411001' };
  const auth = () => ({ Authorization: `Bearer ${token}` });
  const addToCart = (quantity: number) =>
    request(app).post('/api/v1/cart/items').set(auth()).send({ productId: product._id.toString(), sku: 'MUG-1', quantity });

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  beforeEach(async () => {
    await Promise.all([Product, Category, User, Cart, Order, Coupon, StockReservation, Payment].map((model: any) => model.deleteMany({})));
    const category = await Category.create({ name: 'Kitchen', slug: 'kitchen' });
    const user = await User.create({ name: 'Coupon Buyer', email: 'buyer@coupon.test', passwordHash: 'x', role: USER_ROLES.CUSTOMER });
    token = generateAccessToken(user);
    product = await Product.create({
      title: 'Stoneware Mug', slug: 'stoneware-mug', description: 'Mug', categoryId: category._id, basePrice: 500,
      status: PRODUCT_STATUS.PUBLISHED,
      variants: [{ sku: 'MUG-1', attributes: {}, price: 500, stock: 20, images: [] }],
    });
    await Coupon.create({
      code: 'SAVE10', discountType: 'percentage', discountValue: 10, maxDiscount: 150, minOrderValue: 1000,
      startDate: new Date(Date.now() - day), endDate: new Date(Date.now() + day), usageLimitPerUser: 1, showInOffers: true,
    });
  });

  it('cart total includes GST and matches what the order charges', async () => {
    const cart = await addToCart(1);
    // 500 items + 99 shipping + 90 GST
    expect(cart.body.data.pricing).toMatchObject({ itemsTotal: 500, shippingFee: 99, taxTotal: 90, grandTotal: 689 });

    const order = await request(app).post('/api/v1/checkout/create-order').set(auth()).send({ shippingAddress: address });
    expect(order.status).toBe(201);
    expect(order.body.data.order.pricing.grandTotal).toBe(689);
  });

  it('applies a coupon, caps the discount, and rejects baskets under the minimum', async () => {
    await addToCart(1);
    const tooSmall = await request(app).post('/api/v1/cart/coupon').set(auth()).send({ code: 'save10' });
    expect(tooSmall.status).toBe(400);
    expect(tooSmall.body.message).toContain('₹500 more');

    await addToCart(3); // 2000 items
    const applied = await request(app).post('/api/v1/cart/coupon').set(auth()).send({ code: 'save10' });
    expect(applied.status).toBe(200);
    expect(applied.body.data.appliedCoupon).toEqual({ code: 'SAVE10', discountAmount: 150 });
    // 2000 - 150 + 0 shipping + 360 GST
    expect(applied.body.data.pricing).toMatchObject({ discountTotal: 150, grandTotal: 2210 });

    const removed = await request(app).delete('/api/v1/cart/coupon').set(auth());
    expect(removed.body.data.appliedCoupon).toBeNull();
    expect(removed.body.data.pricing.discountTotal).toBe(0);
  });

  it('drops the discount with a reason when the basket falls below the minimum later', async () => {
    await addToCart(4);
    await request(app).post('/api/v1/cart/coupon').set(auth()).send({ code: 'SAVE10' });
    const shrunk = await request(app).patch('/api/v1/cart/items/MUG-1').set(auth()).send({ quantity: 1 });
    expect(shrunk.body.data.pricing.discountTotal).toBe(0);
    expect(shrunk.body.data.couponError).toContain('more to use SAVE10');
  });

  it('rejects unknown, paused and expired codes', async () => {
    await addToCart(4);
    await Coupon.create({ code: 'OLD', discountType: 'flat', discountValue: 50, startDate: new Date(Date.now() - 3 * day), endDate: new Date(Date.now() - day) });
    await Coupon.create({ code: 'PAUSED', discountType: 'flat', discountValue: 50, endDate: new Date(Date.now() + day), isActive: false });
    for (const [code, message] of [['NOPE', 'not valid'], ['OLD', 'expired'], ['PAUSED', 'not valid']]) {
      const res = await request(app).post('/api/v1/cart/coupon').set(auth()).send({ code });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(message);
    }
  });

  it('records the coupon on the order, counts the use, enforces per-customer limits and frees the use on cancel', async () => {
    await addToCart(4);
    await request(app).post('/api/v1/cart/coupon').set(auth()).send({ code: 'SAVE10' });
    const first = await request(app).post('/api/v1/checkout/create-order').set(auth()).send({ shippingAddress: address });
    expect(first.status).toBe(201);
    expect(first.body.data.order.couponCode).toBe('SAVE10');
    expect(first.body.data.order.pricing.discountTotal).toBe(150);
    expect((await Coupon.findOne({ code: 'SAVE10' }))?.usedCount).toBe(1);

    await addToCart(4);
    const again = await request(app).post('/api/v1/cart/coupon').set(auth()).send({ code: 'SAVE10' });
    expect(again.status).toBe(400);
    expect(again.body.message).toContain('already used');

    await OrderService.transitionStatus(first.body.data.order._id, ORDER_STATUS.CANCELLED, 'test');
    expect((await Coupon.findOne({ code: 'SAVE10' }))?.usedCount).toBe(0);
    const afterCancel = await request(app).post('/api/v1/cart/coupon').set(auth()).send({ code: 'SAVE10' });
    expect(afterCancel.status).toBe(200);
  });

  it('lists only advertised, live coupons as public offers without usage internals', async () => {
    await Coupon.create({ code: 'SECRET', discountType: 'flat', discountValue: 100, endDate: new Date(Date.now() + day) });
    await Coupon.create({ code: 'GONE', discountType: 'flat', discountValue: 100, endDate: new Date(Date.now() + day), showInOffers: true, usageLimitGlobal: 1, usedCount: 1 });
    const res = await request(app).get('/api/v1/coupons/offers');
    expect(res.status).toBe(200);
    expect(res.body.data.map((offer: { code: string }) => offer.code)).toEqual(['SAVE10']);
    expect(res.body.data[0].usedCount).toBeUndefined();
  });
});
