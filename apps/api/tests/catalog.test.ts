import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { Category } from '../src/modules/catalog/category.model.js';
import { Brand } from '../src/modules/catalog/brand.model.js';
import { Product } from '../src/modules/catalog/product.model.js';
import { PRODUCT_STATUS } from '@shopsense/shared';

describe('Catalog Integration Tests', () => {
  let mongoServer: MongoMemoryServer;
  const app = createApp();

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
    await Category.deleteMany({});
    await Brand.deleteMany({});
    await Product.deleteMany({});
  });

  it('retrieves categories successfully', async () => {
    await Category.create({
      name: 'Electronics',
      slug: 'electronics',
      description: 'Audio & Gadgets',
    });

    const res = await request(app).get('/api/v1/catalog/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].slug).toBe('electronics');
  });

  it('retrieves products with filters, sorting, and pagination', async () => {
    const category = await Category.create({
      name: 'Audio',
      slug: 'audio',
    });

    const brand = await Brand.create({
      name: 'Sony',
      slug: 'sony',
    });

    await Product.create([
      {
        title: 'Sony Headphones 1',
        slug: 'sony-headphones-1',
        description: 'Quality headphones',
        categoryId: category._id,
        brandId: brand._id,
        basePrice: 5000,
        status: PRODUCT_STATUS.PUBLISHED,
        variants: [{ sku: 'SONY-1', price: 5000, stock: 10, images: [] }],
      },
      {
        title: 'Sony Headphones 2',
        slug: 'sony-headphones-2',
        description: 'Premium headphones',
        categoryId: category._id,
        brandId: brand._id,
        basePrice: 15000,
        status: PRODUCT_STATUS.PUBLISHED,
        variants: [{ sku: 'SONY-2', price: 15000, stock: 5, images: [] }],
      },
    ]);

    // Test filter minPrice = 10000
    const filterRes = await request(app).get('/api/v1/catalog/products?minPrice=10000');
    expect(filterRes.status).toBe(200);
    expect(filterRes.body.data.products).toHaveLength(1);
    expect(filterRes.body.data.products[0].slug).toBe('sony-headphones-2');
    expect(filterRes.body.data.pagination.total).toBe(1);

    // Test detail view by slug
    const detailRes = await request(app).get('/api/v1/catalog/products/sony-headphones-2');
    expect(detailRes.status).toBe(200);
    expect(detailRes.body.data.title).toBe('Sony Headphones 2');
    expect(detailRes.body.data.categoryId.name).toBe('Audio');

    // Test 404 for invalid slug
    const notFoundRes = await request(app).get('/api/v1/catalog/products/unknown-item');
    expect(notFoundRes.status).toBe(404);
  });
});
