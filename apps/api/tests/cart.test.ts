import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Product } from '../src/modules/catalog/product.model.js';
import { Category } from '../src/modules/catalog/category.model.js';
import { User } from '../src/modules/users/user.model.js';
import { Cart } from '../src/modules/cart/cart.model.js';
import { Wishlist } from '../src/modules/cart/wishlist.model.js';
import { PRODUCT_STATUS, USER_ROLES } from '@shopsense/shared';
import { generateAccessToken } from '../src/modules/auth/token.util.js';

describe('Cart & Wishlist Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

  let testProduct: any;
  let testUser: any;
  let userToken: string;

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
    await Wishlist.deleteMany({});

    const cat = await Category.create({ name: 'Sneakers', slug: 'sneakers' });
    testProduct = await Product.create({
      title: 'Air Jordan 1',
      slug: 'air-jordan-1',
      description: 'Iconic shoe',
      categoryId: cat._id,
      basePrice: 12000,
      status: PRODUCT_STATUS.PUBLISHED,
      variants: [
        {
          sku: 'AJ1-RED-9',
          attributes: { size: '9' },
          price: 12000,
          stock: 5,
          images: [],
        },
      ],
    });

    testUser = await User.create({
      name: 'Sneaker Head',
      email: 'sneaker@test.com',
      passwordHash: 'dummyhash',
      role: USER_ROLES.CUSTOMER,
    });
    userToken = generateAccessToken(testUser);
  });

  it('allows guest to add item, update quantity, and fetch cart by session id', async () => {
    const sessionId = 'guest-session-123';

    // 1. Add item
    const addRes = await request(app)
      .post('/api/v1/cart/items')
      .set('x-session-id', sessionId)
      .send({
        productId: testProduct._id.toString(),
        sku: 'AJ1-RED-9',
        quantity: 2,
      });

    expect(addRes.status).toBe(200);
    expect(addRes.body.data.items).toHaveLength(1);
    expect(addRes.body.data.items[0].quantity).toBe(2);
    expect(addRes.body.data.pricing.itemsTotal).toBe(24000);

    // 2. Update quantity to 3
    const updateRes = await request(app)
      .patch('/api/v1/cart/items/AJ1-RED-9')
      .set('x-session-id', sessionId)
      .send({ quantity: 3 });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.data.items[0].quantity).toBe(3);
    expect(updateRes.body.data.pricing.itemsTotal).toBe(36000);

    // 3. Prevent adding more than available stock (stock is 5, requested total 6)
    const overStockRes = await request(app)
      .patch('/api/v1/cart/items/AJ1-RED-9')
      .set('x-session-id', sessionId)
      .send({ quantity: 6 });

    expect(overStockRes.status).toBe(400);
    expect(overStockRes.body.message).toContain('available in stock');
  });

  it('merges guest cart items into authenticated user cart upon login', async () => {
    const guestSessionId = 'guest-session-merge-test';

    // Guest adds 2 pairs of shoes
    await request(app)
      .post('/api/v1/cart/items')
      .set('x-session-id', guestSessionId)
      .send({
        productId: testProduct._id.toString(),
        sku: 'AJ1-RED-9',
        quantity: 2,
      });

    // User calls merge endpoint with their auth token
    const mergeRes = await request(app)
      .post('/api/v1/cart/merge')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ guestSessionId });

    expect(mergeRes.status).toBe(200);
    expect(mergeRes.body.data.items).toHaveLength(1);
    expect(mergeRes.body.data.items[0].quantity).toBe(2);
    expect(mergeRes.body.data.userId.toString()).toBe(testUser._id.toString());

    // Verify guest cart was deleted from DB
    const oldGuestCart = await Cart.findOne({ sessionId: guestSessionId });
    expect(oldGuestCart).toBeNull();
  });

  it('handles user wishlist toggling', async () => {
    // Add to wishlist
    const addWishRes = await request(app)
      .post(`/api/v1/cart/wishlist/${testProduct._id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(addWishRes.status).toBe(200);
    expect(addWishRes.body.data.productIds).toHaveLength(1);

    // Remove from wishlist
    const remWishRes = await request(app)
      .delete(`/api/v1/cart/wishlist/${testProduct._id}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(remWishRes.status).toBe(200);
    expect(remWishRes.body.data.productIds).toHaveLength(0);
  });
});
