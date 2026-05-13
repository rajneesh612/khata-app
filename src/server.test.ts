import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { app } from './server';
import { initDb } from './db';

describe('API Endpoints', () => {
  beforeAll(async () => {
    // Ensure DB is initialized before tests
    await initDb();
  });

  it('should return a list of customers', async () => {
    const response = await request(app).get('/api/customers');

    expect(response.status).toBe(404);
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
      .send(newCustomer);

    expect(response.status).toBe(201);
    expect(response.body.name).toBe(newCustomer.name);
    expect(response.body.id).toBeDefined();
  });
});
