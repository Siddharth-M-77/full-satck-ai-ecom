import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('API Health Checks', () => {
  const app = createApp();

  it('GET /health returns 200 and UP status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('UP');
    expect(res.body.service).toBe('ShopSense API');
    expect(res.headers['x-request-id']).toBeDefined();
  });

  it('GET / non-existent route returns 404 with standard error format', async () => {
    const res = await request(app).get('/non-existent-route');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('ERR_404');
    expect(res.headers['x-request-id']).toBeDefined();
  });
});
