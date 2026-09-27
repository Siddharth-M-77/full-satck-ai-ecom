import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { createApp } from '../src/app.js';
import { User } from '../src/modules/users/user.model.js';
import { Address } from '../src/modules/users/address.model.js';
import { USER_ROLES } from '@shopsense/shared';

describe('Auth & RBAC Integration Tests', () => {
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
    await User.deleteMany({});
    await Address.deleteMany({});
  });

  describe('User Registration (POST /api/v1/auth/register)', () => {
    it('successfully registers a user with valid credentials', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe('jane@example.com');
      expect(res.body.data.user.role).toBe(USER_ROLES.CUSTOMER);
      expect(res.body.data.accessToken).toBeDefined();

      // Check HttpOnly refresh token cookie
      const cookies = res.headers['set-cookie'] as unknown as string[];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('shopsense_refresh_token');
      expect(cookies[0]).toContain('HttpOnly');
    });

    it('rejects registration with short password (< 8 chars)', async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Jane Doe',
        email: 'jane@example.com',
        password: 'short',
      });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('prevents duplicate email registration (409 Conflict)', async () => {
      await request(app).post('/api/v1/auth/register').send({
        name: 'Jane Doe',
        email: 'duplicate@example.com',
        password: 'Password123!',
      });

      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Another Jane',
        email: 'duplicate@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });
  });

  describe('User Login & Refresh Token Rotation', () => {
    beforeEach(async () => {
      await request(app).post('/api/v1/auth/register').send({
        name: 'John Doe',
        email: 'john@example.com',
        password: 'Password123!',
      });
    });

    it('logs in successfully with correct credentials', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'john@example.com',
        password: 'Password123!',
      });

      expect(res.status).toBe(200);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toBe('john@example.com');
    });

    it('rejects login with incorrect password (401)', async () => {
      const res = await request(app).post('/api/v1/auth/login').send({
        email: 'john@example.com',
        password: 'WrongPassword!',
      });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('rotates refresh token and issues new access token', async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'john@example.com',
        password: 'Password123!',
      });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = cookies[0].split(';')[0]; // shopsense_refresh_token=...

      // Refresh using cookie
      const refreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(refreshRes.status).toBe(200);
      expect(refreshRes.body.data.accessToken).toBeDefined();

      const newCookies = refreshRes.headers['set-cookie'] as unknown as string[];
      expect(newCookies[0]).toContain('shopsense_refresh_token');

      // The old refresh token should now be invalidated
      const replayRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(replayRes.status).toBe(401);
    });

    it('logs out and revokes refresh token', async () => {
      const loginRes = await request(app).post('/api/v1/auth/login').send({
        email: 'john@example.com',
        password: 'Password123!',
      });

      const cookies = loginRes.headers['set-cookie'] as unknown as string[];
      const refreshCookie = cookies[0].split(';')[0];

      const logoutRes = await request(app)
        .post('/api/v1/auth/logout')
        .set('Cookie', [refreshCookie]);

      expect(logoutRes.status).toBe(200);

      // Verify token can no longer be refreshed
      const tryRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', [refreshCookie]);

      expect(tryRefresh.status).toBe(401);
    });
  });

  describe('RBAC Authorization', () => {
    it('restricts admin-only route from regular customer (403 Forbidden)', async () => {
      const customerRes = await request(app).post('/api/v1/auth/register').send({
        name: 'Regular Customer',
        email: 'customer@example.com',
        password: 'Password123!',
      });

      const token = customerRes.body.data.accessToken;

      const rbacRes = await request(app)
        .get('/api/v1/admin/rbac-check')
        .set('Authorization', `Bearer ${token}`);

      expect(rbacRes.status).toBe(403);
      expect(rbacRes.body.message).toContain('insufficient role privileges');
    });

    it('allows access to admin-only route for admin role (200 OK)', async () => {
      // Create user and promote to admin
      const adminUser = new User({
        name: 'Admin Boss',
        email: 'admin@shopsense.ai',
        passwordHash: 'dummyhash',
        role: USER_ROLES.ADMIN,
      });
      await adminUser.save();

      // Login as admin
      const { generateAccessToken } = await import(
        '../src/modules/auth/token.util.js'
      );
      const token = generateAccessToken(adminUser);

      const rbacRes = await request(app)
        .get('/api/v1/admin/rbac-check')
        .set('Authorization', `Bearer ${token}`);

      expect(rbacRes.status).toBe(200);
      expect(rbacRes.body.success).toBe(true);
    });
  });

  describe('Address Book CRUD', () => {
    let customerToken: string;

    beforeEach(async () => {
      const res = await request(app).post('/api/v1/auth/register').send({
        name: 'Address Tester',
        email: 'address@example.com',
        password: 'Password123!',
      });
      customerToken = res.body.data.accessToken;
    });

    it('creates first address and automatically designates it as default', async () => {
      const res = await request(app)
        .post('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          fullName: 'Siddharth S',
          phone: '9876543210',
          addressLine1: '42 Silicon Avenue, 3rd Floor',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
          country: 'IN',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.isDefault).toBe(true);
      expect(res.body.data.city).toBe('Bengaluru');
    });

    it('handles multiple addresses and updates default selection properly', async () => {
      // Add Address 1
      const addr1 = await request(app)
        .post('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          fullName: 'Siddharth Home',
          phone: '9876543210',
          addressLine1: 'Home Address',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560001',
        });

      // Add Address 2 explicitly as default
      const addr2 = await request(app)
        .post('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({
          fullName: 'Siddharth Office',
          phone: '9876543210',
          addressLine1: 'Office Address',
          city: 'Bengaluru',
          state: 'Karnataka',
          postalCode: '560100',
          isDefault: true,
        });

      expect(addr2.body.data.isDefault).toBe(true);

      // Verify list: addr2 is default, addr1 is no longer default
      const listRes = await request(app)
        .get('/api/v1/users/addresses')
        .set('Authorization', `Bearer ${customerToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data).toHaveLength(2);
      expect(listRes.body.data[0]._id).toBe(addr2.body.data._id);
      expect(listRes.body.data[0].isDefault).toBe(true);
      expect(listRes.body.data[1].isDefault).toBe(false);
    });
  });
});
