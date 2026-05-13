import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './server';
import { initDb } from './db';

describe('API Endpoints', () => {
  let token: string;

  beforeAll(async () => {
    // Ensure DB is initialized before tests
    await initDb();
    
    // Create a shop and login to get token
    const shopData = {
      shop_name: 'Test Shop',
      owner_name: 'Test Owner',
      email: `test-${Date.now()}@example.com`,
      password: 'password123'
    };

    await request(app).post('/api/auth/signup').send(shopData);
    const loginResp = await request(app).post('/api/auth/login').send({
      email: shopData.email,
      password: shopData.password
    });
    token = loginResp.body.token;
  });

  it('should return a list of customers', async () => {
    const response = await request(app)
      .get('/api/customers')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body)).toBe(true);
  });

  it('should create a new customer', async () => {
    const newCustomer = {
      name: 'Test API Customer',
      phone: '9876543210',
      address: 'Test Address'
    };

    const response = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send(newCustomer);

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(newCustomer.name);
    expect(response.body.id).toBeDefined();
  });
});
