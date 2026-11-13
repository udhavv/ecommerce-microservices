import { jest } from '@jest/globals';
import { z } from 'zod';
import { AppError, errorHandler } from '../../middleware/errorHandler.js';
import { validate } from '../../middleware/validate.middleware.js';

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    isProduction: false,
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Middleware Unit Tests (Orders Service)', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      body: {},
      query: {},
      params: {},
      originalUrl: '/api/orders',
      method: 'POST',
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('validate middleware', () => {
    const testSchema = z.object({
      name: z.string().min(2),
      quantity: z.number().int().positive(),
    });

    it('should validate and pass sanitized data to req[source] and call next', () => {
      req.body = { name: 'Widget', quantity: 5 };
      const middleware = validate(testSchema, 'body');

      middleware(req, res, next);

      expect(req.body).toEqual({ name: 'Widget', quantity: 5 });
      expect(next).toHaveBeenCalledWith();
    });

    it('should forward validation error to next(err) if parsing fails', () => {
      req.body = { name: 'W', quantity: -1 };
      const middleware = validate(testSchema, 'body');

      middleware(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(z.ZodError));
    });

    it('should validate from custom source like query parameters', () => {
      const querySchema = z.object({ page: z.string() });
      req.query = { page: '2' };
      const middleware = validate(querySchema, 'query');

      middleware(req, res, next);

      expect(req.query.page).toBe('2');
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('errorHandler middleware', () => {
    it('should handle AppError and return corresponding statusCode', () => {
      const appErr = new AppError('Order not found', 404, { orderId: 123 });

      errorHandler(appErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Order not found',
          details: { orderId: 123 },
        })
      );
    });

    it('should map PostgreSQL 23505 unique violation code to 409 conflict', () => {
      const pgErr = new Error('duplicate key');
      pgErr.code = '23505';
      pgErr.detail = 'Key (idempotency_key)=(abc) already exists.';

      errorHandler(pgErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'An order with this identifier or idempotency key already exists.',
          details: 'Key (idempotency_key)=(abc) already exists.',
        })
      );
    });

    it('should map PostgreSQL 23503 foreign key violation to 400', () => {
      const pgErr = new Error('foreign key');
      pgErr.code = '23503';
      pgErr.detail = 'Key (user_id)=(usr-999) is not present in table users.';

      errorHandler(pgErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Referenced entity could not be found.',
        })
      );
    });

    it('should map PostgreSQL 23514 check violation to 400', () => {
      const pgErr = new Error('check violation');
      pgErr.code = '23514';

      errorHandler(pgErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Data check constraint violated.',
        })
      );
    });

    it('should format ZodError into 400 with path and message details', () => {
      const schema = z.object({ age: z.number() });
      let zodErr;
      try {
        schema.parse({ age: 'not-a-number' });
      } catch (err) {
        zodErr = err;
      }

      errorHandler(zodErr, req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Validation error',
          details: expect.arrayContaining([
            expect.objectContaining({
              field: 'age',
            }),
          ]),
        })
      );
    });

    it('should return 500 for generic unhandled exceptions', () => {
      const err = new Error('Unexpected crash');

      errorHandler(err, req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Unexpected crash',
        })
      );
    });
  });
});
