import { jest } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import env from '../../config/env.js';
import { mockPool, withTransaction, resetDatabase, tables } from '../helpers/mock-db.js';

// Mock DB module
jest.unstable_mockModule('../../config/db.js', () => ({
  pool: mockPool,
  query: mockPool.query,
  withTransaction: withTransaction,
}));

// Mock database/init.js so server doesn't execute filesystem migrations during tests
jest.unstable_mockModule('../../../database/init.js', () => ({
  initDatabase: jest.fn(async () => true),
}));

// Import Express app after module mocks are installed
const { default: app } = await import('../../index.js');

function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      roles: user.roles || ['user'],
    },
    env.jwt.accessSecret,
    { expiresIn: '1h' }
  );
}

describe('Review & Engagement Microservice - Integration Tests', () => {
  const user1 = { id: '11111111-1111-1111-1111-111111111111', email: 'alice@test.com', displayName: 'Alice', roles: ['user'] };
  const user2 = { id: '22222222-2222-2222-2222-222222222222', email: 'bob@test.com', displayName: 'Bob', roles: ['user'] };
  const admin = { id: '99999999-9999-9999-9999-999999999999', email: 'admin@test.com', displayName: 'Moderator', roles: ['admin', 'user'] };

  const tokenUser1 = generateToken(user1);
  const tokenUser2 = generateToken(user2);
  const tokenAdmin = generateToken(admin);

  const testProductId = 50;

  beforeEach(() => {
    resetDatabase();
    jest.clearAllMocks();
  });

  describe('1. Health Check Endpoint', () => {
    it('GET /health returns 200 and healthy service status', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('review-section-service');
      expect(res.body.database).toBe('connected');
    });
  });

  describe('2. Review Management Endpoints', () => {
    const validReviewPayload = {
      product_id: testProductId,
      rating: 5,
      title: 'Superb quality and battery life',
      comment: 'Exceeded all my expectations. Highly recommended!',
      images: ['https://images.com/rev1.jpg'],
    };

    it('POST /api/reviews blocks unauthenticated requests with 401', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .send(validReviewPayload);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/reviews rejects invalid rating (<1 or >5) with 400', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          ...validReviewPayload,
          rating: 6,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/reviews creates review successfully when authenticated', async () => {
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.review.id).toBeDefined();
      expect(res.body.data.review.product_id).toBe(testProductId);
      expect(res.body.data.review.rating).toBe(5);
      expect(res.body.data.review.customer_name).toBe(user1.displayName);
      expect(res.body.data.review.images.length).toBe(1);
    });

    it('POST /api/reviews rejects duplicate review submission with 409 Conflict', async () => {
      // First submission
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      // Duplicate submission
      const res = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
    });

    it('GET /api/reviews/product/:productId returns list of reviews', async () => {
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      const res = await request(app).get(`/api/reviews/product/${testProductId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.reviews)).toBe(true);
      expect(res.body.data.reviews.length).toBe(1);
      expect(res.body.data.pagination.total).toBe(1);
    });

    it('GET /api/reviews/product/:productId/summary returns aggregated rating breakdown', async () => {
      await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      const res = await request(app).get(`/api/reviews/product/${testProductId}/summary`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.summary.product_id).toBe(testProductId);
      expect(Number(res.body.data.summary.total_reviews)).toBe(1);
      expect(Number(res.body.data.summary.average_rating)).toBe(5);
    });

    it('PUT /api/reviews/:id blocks other users from modifying someone else review (403)', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      const reviewId = createRes.body.data.review.id;

      const res = await request(app)
        .put(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${tokenUser2}`)
        .send({ rating: 1, comment: 'Hacked comment' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('PUT /api/reviews/:id allows author to update their review', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      const reviewId = createRes.body.data.review.id;

      const res = await request(app)
        .put(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({ rating: 4, comment: 'Updated to 4 stars after long term use' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.review.rating).toBe(4);
    });

    it('POST /api/reviews/:id/vote blocks author from voting on their own review (400)', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      const reviewId = createRes.body.data.review.id;

      const res = await request(app)
        .post(`/api/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({ vote_type: 'HELPFUL' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('POST /api/reviews/:id/vote allows another user to cast a helpful vote', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      const reviewId = createRes.body.data.review.id;

      const res = await request(app)
        .post(`/api/reviews/${reviewId}/vote`)
        .set('Authorization', `Bearer ${tokenUser2}`)
        .send({ vote_type: 'HELPFUL' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.helpful_count).toBe(1);
    });

    it('POST /api/reviews/:id/report logs an abuse report', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      const reviewId = createRes.body.data.review.id;

      const res = await request(app)
        .post(`/api/reviews/${reviewId}/report`)
        .set('Authorization', `Bearer ${tokenUser2}`)
        .send({ reason: 'SPAM', description: 'Promoting external site' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.report.reason).toBe('SPAM');
    });

    it('DELETE /api/reviews/:id blocks non-owner with 403 and allows owner with 200', async () => {
      const createRes = await request(app)
        .post('/api/reviews')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send(validReviewPayload);

      const reviewId = createRes.body.data.review.id;

      // 1. Non-owner blocked
      const blockRes = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${tokenUser2}`);
      expect(blockRes.status).toBe(403);

      // 2. Owner succeeds
      const delRes = await request(app)
        .delete(`/api/reviews/${reviewId}`)
        .set('Authorization', `Bearer ${tokenUser1}`);
      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });
  });

  describe('3. Questions & Answers Endpoints', () => {
    it('POST /api/questions creates a product question', async () => {
      const res = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          product_id: testProductId,
          question: 'Does this product come with international warranty?',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question.question).toBe('Does this product come with international warranty?');
    });

    it('GET /api/questions/product/:productId retrieves questions and answers', async () => {
      await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          product_id: testProductId,
          question: 'Is it waterproof?',
        });

      const res = await request(app).get(`/api/questions/product/${testProductId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.questions)).toBe(true);
      expect(res.body.data.questions.length).toBe(1);
    });

    it('POST /api/questions/:id/answers submits an answer to a question', async () => {
      const qRes = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          product_id: testProductId,
          question: 'What is the battery life?',
        });

      const qId = qRes.body.data.question.id;

      const res = await request(app)
        .post(`/api/questions/${qId}/answers`)
        .set('Authorization', `Bearer ${tokenUser2}`)
        .send({ answer: 'Up to 30 hours on a full charge.' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answer.answer).toBe('Up to 30 hours on a full charge.');
    });

    it('DELETE /api/questions/:id allows author to delete question', async () => {
      const qRes = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${tokenUser1}`)
        .send({
          product_id: testProductId,
          question: 'Question to be deleted',
        });

      const qId = qRes.body.data.question.id;

      const delRes = await request(app)
        .delete(`/api/questions/${qId}`)
        .set('Authorization', `Bearer ${tokenUser1}`);

      expect(delRes.status).toBe(200);
      expect(delRes.body.success).toBe(true);
    });
  });

  describe('4. Route 404 Fallback', () => {
    it('returns 404 for unrecognized route', async () => {
      const res = await request(app).get('/api/unregistered-path');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
