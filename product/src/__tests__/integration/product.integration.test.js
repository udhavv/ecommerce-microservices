import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import { mockPool, resetDatabase, tables } from '../helpers/mock-db.js';

// Mock DB pool
jest.unstable_mockModule('../../config/db.js', () => ({
  pool: mockPool,
  query: mockPool.query,
  getClient: mockPool.connect,
}));

// Mock Cloudinary
jest.unstable_mockModule('../../config/cloudinary.js', () => ({
  deleteCloudinaryImage: jest.fn(async () => true),
  uploadImageBuffer: jest.fn(async () => ({
    secure_url: 'https://res.cloudinary.com/test/uploaded.jpg',
    public_id: 'test-pub-id',
  })),
}));

// Mock global fetch for inventory service
global.fetch = jest.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ success: true }),
  text: async () => 'ok',
}));

// Import app after module mocks are configured
const { default: app } = await import('../../index.js');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      roles: user.roles || ['user'],
    },
    env.jwt.accessSecret,
    { expiresIn: '1h' }
  );
}

describe('Product Microservice - Integration Tests', () => {
  const sellerA = { id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', email: 'sellerA@shop.com', roles: ['seller'] };
  const sellerB = { id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', email: 'sellerB@shop.com', roles: ['seller'] };
  const customer = { id: 'cccccccc-cccc-cccc-cccc-cccccccccccc', email: 'buyer@shop.com', roles: ['user'] };
  const admin = { id: 'dddddddd-dddd-dddd-dddd-dddddddddddd', email: 'admin@shop.com', roles: ['admin', 'seller'] };

  const tokenSellerA = generateToken(sellerA);
  const tokenSellerB = generateToken(sellerB);
  const tokenCustomer = generateToken(customer);
  const tokenAdmin = generateToken(admin);

  beforeEach(() => {
    resetDatabase();
    jest.clearAllMocks();

    // Pre-populate standard category
    tables.categories.push({
      id: 1,
      name: 'Electronics',
      slug: 'electronics',
      description: 'Electronic gadgets',
      parent_id: null,
      is_active: true,
      created_at: new Date(),
      updated_at: new Date(),
    });
  });

  describe('1. Health Check Endpoint', () => {
    it('GET /health returns 200 and healthy service status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('product-service');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('2. Category Management Endpoints', () => {
    it('GET /api/categories returns category list', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.categories)).toBe(true);
      expect(res.body.data.categories.length).toBeGreaterThan(0);
      expect(res.body.data.categories[0].slug).toBe('electronics');
    });

    it('GET /api/categories/:id returns single category details', async () => {
      const res = await request(app).get('/api/categories/1');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category.id).toBe(1);
      expect(res.body.data.category.name).toBe('Electronics');
    });

    it('POST /api/categories blocks unauthenticated users with 401', async () => {
      const res = await request(app)
        .post('/api/categories')
        .send({ name: 'Smart Home' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/categories blocks normal user with 403', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${tokenCustomer}`)
        .send({ name: 'Smart Home' });

      expect(res.status).toBe(403);
    });

    it('POST /api/categories allows admin to create category', async () => {
      const res = await request(app)
        .post('/api/categories')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ name: 'Audio & Sound', description: 'Headphones and speakers' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.category.name).toBe('Audio & Sound');
      expect(res.body.data.category.slug).toBe('audio-sound');
    });
  });

  describe('3. Product Creation & Authorization Flow', () => {
    const validProductPayload = {
      name: 'Sony WH-1000XM5 Noise Canceling Headphones',
      description: 'Flagship wireless active noise canceling headphones with 30-hour battery life.',
      brand: 'Sony',
      price: 399.99,
      category_ids: [1],
      image_url: 'https://res.cloudinary.com/test/sony-xm5.jpg',
    };

    it('POST /api/products blocks unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/products')
        .send(validProductPayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/products blocks customer accounts with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenCustomer}`)
        .send(validProductPayload);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/products rejects invalid payload with 400 Validation Error', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenSellerA}`)
        .send({
          name: '',
          price: -10,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/products allows seller to create a product successfully', async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenSellerA}`)
        .send(validProductPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.id).toBeDefined();
      expect(res.body.data.product.name).toBe(validProductPayload.name);
      expect(res.body.data.product.brand).toBe('Sony');
      expect(res.body.data.product.seller_id).toBe(sellerA.id);
      expect(res.body.data.product.variants.length).toBeGreaterThan(0);
      expect(res.body.data.product.images.length).toBeGreaterThan(0);
    });
  });

  describe('4. Product Listing & Detail Retrieval', () => {
    let createdProductId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenSellerA}`)
        .send({
          name: 'MacBook Pro 16 M3 Max',
          description: 'Apple silicon powerhouse workstation.',
          brand: 'Apple',
          price: 2499.0,
          category_ids: [1],
          image_url: 'https://res.cloudinary.com/test/macbook.jpg',
        });
      createdProductId = res.body.data.product.id;
    });

    it('GET /api/products lists available products with pagination', async () => {
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.products)).toBe(true);
      expect(res.body.data.pagination.total).toBeGreaterThan(0);
    });

    it('GET /api/products/:id retrieves product with full variants and images', async () => {
      const res = await request(app).get(`/api/products/${createdProductId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.id).toBe(createdProductId);
      expect(res.body.data.product.brand).toBe('Apple');
      expect(res.body.data.product.variants.length).toBeGreaterThan(0);
      expect(res.body.data.product.images.length).toBeGreaterThan(0);
    });

    it('GET /api/products/:idOrSlug retrieves product by text slug', async () => {
      const res = await request(app).get('/api/products/macbook-pro-16-m3-max');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.slug).toBe('macbook-pro-16-m3-max');
    });

    it('GET /api/products/999999 returns 404 for non-existent product', async () => {
      const res = await request(app).get('/api/products/999999');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });

  describe('5. Ownership Enforcement on Updates & Deletions', () => {
    let productId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenSellerA}`)
        .send({
          name: 'iPad Pro 13',
          description: 'OLED tablet for creative professionals.',
          brand: 'Apple',
          price: 1299.0,
          category_ids: [1],
          image_url: 'https://res.cloudinary.com/test/ipad.jpg',
        });
      productId = res.body.data.product.id;
    });

    it('PUT /api/products/:id blocks other sellers from editing someone else product (403)', async () => {
      const res = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenSellerB}`)
        .send({ name: 'Hacked iPad Pro' });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('PUT /api/products/:id allows the owner seller to update their product', async () => {
      const res = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenSellerA}`)
        .send({ name: 'iPad Pro 13 M4 Edition' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.name).toBe('iPad Pro 13 M4 Edition');
    });

    it('PUT /api/products/:id allows admin to update any product', async () => {
      const res = await request(app)
        .put(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({ brand: 'Apple Official' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.product.brand).toBe('Apple Official');
    });

    it('DELETE /api/products/:id blocks non-owner sellers with 403', async () => {
      const res = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenSellerB}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('Forbidden');
    });

    it('DELETE /api/products/:id allows owner seller to delete their product', async () => {
      const res = await request(app)
        .delete(`/api/products/${productId}`)
        .set('Authorization', `Bearer ${tokenSellerA}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('deleted successfully');

      // Subsequent fetch returns 404
      const checkRes = await request(app).get(`/api/products/${productId}`);
      expect(checkRes.status).toBe(404);
    });
  });

  describe('6. Variants & Images Sub-Endpoints', () => {
    let productId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/products')
        .set('Authorization', `Bearer ${tokenSellerA}`)
        .send({
          name: 'Mechanical Keyboard TKL',
          description: 'Hot-swappable mechanical gaming keyboard.',
          brand: 'Keychron',
          price: 99.0,
          category_ids: [1],
          image_url: 'https://res.cloudinary.com/test/keyboard.jpg',
        });
      productId = res.body.data.product.id;
    });

    it('GET /api/products/:id/variants returns product variants', async () => {
      const res = await request(app).get(`/api/products/${productId}/variants`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.variants)).toBe(true);
    });

    it('POST /api/products/:id/variants creates a new variant for product', async () => {
      const res = await request(app)
        .post(`/api/products/${productId}/variants`)
        .set('Authorization', `Bearer ${tokenSellerA}`)
        .send({
          sku: `KEYCHRON-RED-${Date.now()}`,
          variant_name: 'Red Switches',
          price: 109.0,
          currency: 'USD',
          is_active: true,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.variant.variant_name).toBe('Red Switches');
      expect(Number(res.body.data.variant.price)).toBe(109.0);
    });

    it('GET /api/products/:id/images returns product images', async () => {
      const res = await request(app).get(`/api/products/${productId}/images`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.images)).toBe(true);
    });
  });

  describe('7. Route Fallbacks', () => {
    it('returns 404 for unknown endpoints', async () => {
      const res = await request(app).get('/api/unknown-service-path');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('Route not found');
    });
  });
});
