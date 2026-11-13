import { jest } from '@jest/globals';
import { AppError } from '../../middleware/errorHandler.js';

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    jwt: { accessSecret: 'test-secret' },
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { default: jwt } = await import('jsonwebtoken');
const { authenticate, requireAuth, requireRole } = await import('../../middleware/auth.middleware.js');

describe('Auth Middleware Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      headers: {},
      cookies: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('authenticate', () => {
    it('should authenticate internal service when x-internal-service header is present', () => {
      req.headers['x-internal-service'] = 'order-service';
      req.headers['x-user-roles'] = 'admin,system';

      authenticate(req, res, next);

      expect(req.user).toEqual({
        id: 'system-internal',
        email: 'order-service@ecommerce.internal',
        roles: ['admin', 'system'],
        isInternalService: true,
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should authenticate via Kong gateway forwarded headers', () => {
      req.headers['x-user-id'] = 'user-123';
      req.headers['x-user-email'] = 'test@example.com';
      req.headers['x-user-roles'] = '["seller", "customer"]';

      authenticate(req, res, next);

      expect(req.user).toEqual({
        id: 'user-123',
        email: 'test@example.com',
        roles: ['seller', 'customer'],
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should authenticate via Authorization Bearer token header', () => {
      req.headers.authorization = 'Bearer valid-jwt-token';
      jwt.verify.mockReturnValueOnce({
        id: 'user-jwt-1',
        email: 'jwt@example.com',
        roles: ['customer'],
      });

      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('valid-jwt-token', 'test-secret');
      expect(req.user).toEqual({
        id: 'user-jwt-1',
        email: 'jwt@example.com',
        roles: ['customer'],
      });
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should authenticate via cookie accessToken', () => {
      req.cookies.accessToken = 'cookie-jwt-token';
      jwt.verify.mockReturnValueOnce({
        id: 'user-cookie-1',
        email: 'cookie@example.com',
        roles: ['admin'],
      });

      authenticate(req, res, next);

      expect(jwt.verify).toHaveBeenCalledWith('cookie-jwt-token', 'test-secret');
      expect(req.user.id).toBe('user-cookie-1');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should set req.user to null and continue if no credentials provided', () => {
      authenticate(req, res, next);

      expect(req.user).toBeNull();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireAuth', () => {
    it('should return 401 if req.user is null', () => {
      req.user = null;
      requireAuth(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should proceed to next if req.user exists', () => {
      req.user = { id: 'usr-1', roles: ['customer'] };
      requireAuth(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireRole', () => {
    it('should return 401 if req.user is missing', () => {
      req.user = null;
      const roleMiddleware = requireRole(['seller', 'admin']);
      roleMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 if user roles do not match required roles', () => {
      req.user = { id: 'usr-1', roles: ['customer'] };
      const roleMiddleware = requireRole(['seller', 'admin']);
      roleMiddleware(req, res, next);
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: expect.stringContaining('Forbidden: This action requires one of the following roles'),
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next if user has at least one of the allowed roles', () => {
      req.user = { id: 'usr-1', roles: ['seller'] };
      const roleMiddleware = requireRole(['seller', 'admin']);
      roleMiddleware(req, res, next);
      expect(next).toHaveBeenCalledTimes(1);
    });
  });
});
