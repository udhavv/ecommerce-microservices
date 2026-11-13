// import { jest } from '@jest/globals'

// jest.unstable_mockModule('../../config/env.js', () => ({
//     default: {
//         jwt: { accessSecret: 'thisisthesecret'},
//     },
// }));

// jest.unstable_mockModule('jsonwebtoken', () => ({
//     default: {
//         verify: jest.fn(),
//     },
// }));


// const {default: jwt} = await import('jsonwebtoken')
// const {authenticate, requireAuth, requireRole}= await import('../../middleware/auth.middleware.js');


// describe('Auth middleware for orders test', () => {
//     let req, res, next;

//     beforeEach(() => {
//         jest.clearAllMocks();
//         req={
//             headers: {},
//             cookie: {}
//         };

//         res= {
//             status: jest.fn().mockReturnThis(),
//             json: jest.fn().mockReturnThis(),
//         };
//         nest= jest.fn();
//     });


//     describe('authenticate', () => {
//         iti('')
//     })
// })











import { jest } from '@jest/globals';

jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    jwt: {
      accessSecret: 'test-orders-jwt-secret-key-12345',
    },
  },
}));

const { default: jwt } = await import('jsonwebtoken');
const { default: env } = await import('../../config/env.js');
const authModule = await import('../../middleware/auth.middleware.js');
const { authenticate, requireAuth, requireRole } = authModule;

describe('Auth Middleware Unit Tests (Orders Service)', () => {
  let req, res, next;
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

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

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('authenticate', () => {
    describe('Cookie-based authentication', () => {
      it('should authenticate via req.cookies.accessToken and populate req.user', () => {
        req.cookies.accessToken = 'valid-cookie-access-token';
        const decodedToken = {
          id: 'usr-101',
          email: 'buyer@example.com',
          displayName: 'Buyer One',
          roles: ['CUSTOMER'],
        };
        jwt.verify.mockReturnValueOnce(decodedToken);

        authenticate(req, res, next);

        expect(jwt.verify).toHaveBeenCalledWith('valid-cookie-access-token', env.jwt.accessSecret);
        expect(req.user).toEqual({
          id: 'usr-101',
          email: 'buyer@example.com',
          displayName: 'Buyer One',
          roles: ['customer'],
        });
        expect(next).toHaveBeenCalledTimes(1);
      });

      it('should authenticate via req.cookies.access_token fallback when accessToken is not present', () => {
        req.cookies.access_token = 'valid-snake-case-token';
        const decodedToken = {
          id: 'usr-102',
          email: 'snake@example.com',
          displayName: 'Snake Case',
          roles: ['CUSTOMER'],
        };
        jwt.verify.mockReturnValueOnce(decodedToken);

        authenticate(req, res, next);

        expect(jwt.verify).toHaveBeenCalledWith('valid-snake-case-token', env.jwt.accessSecret);
        expect(req.user.id).toBe('usr-102');
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe('Authorization header authentication', () => {
      it('should authenticate via Authorization Bearer token header', () => {
        req.headers.authorization = 'Bearer header-bearer-token';
        const decodedToken = {
          id: 'usr-201',
          email: 'bearer@example.com',
          displayName: 'Bearer User',
          roles: ['Admin', 'Manager'],
        };
        jwt.verify.mockReturnValueOnce(decodedToken);

        authenticate(req, res, next);

        expect(jwt.verify).toHaveBeenCalledWith('header-bearer-token', env.jwt.accessSecret);
        expect(req.user).toEqual({
          id: 'usr-201',
          email: 'bearer@example.com',
          displayName: 'Bearer User',
          roles: ['admin', 'manager'],
        });
        expect(next).toHaveBeenCalledTimes(1);
      });

      it('should not extract token if Authorization header does not start with Bearer ', () => {
        req.headers.authorization = 'Basic dXNlcjpwYXNz';

        authenticate(req, res, next);

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe('Decoded payload fallback mappings', () => {
      it('should resolve user id using decoded.userId when decoded.id is missing', () => {
        req.cookies.accessToken = 'token-with-userId';
        jwt.verify.mockReturnValueOnce({
          userId: 'user-id-from-claim',
          email: 'user@example.com',
          name: 'Fallback Name',
        });

        authenticate(req, res, next);

        expect(req.user.id).toBe('user-id-from-claim');
        expect(req.user.displayName).toBe('Fallback Name');
      });

      it('should resolve user id using decoded.sub when decoded.id and decoded.userId are missing', () => {
        req.cookies.accessToken = 'token-with-sub';
        jwt.verify.mockReturnValueOnce({
          sub: 'sub-claim-id',
          email: 'sub@example.com',
        });

        authenticate(req, res, next);

        expect(req.user.id).toBe('sub-claim-id');
        expect(req.user.displayName).toBeUndefined();
      });

      it('should default roles to empty array when decoded.roles is not an array', () => {
        req.cookies.accessToken = 'token-without-roles';
        jwt.verify.mockReturnValueOnce({
          id: 'usr-no-roles',
          roles: 'invalid-roles-string',
        });

        authenticate(req, res, next);

        expect(req.user.roles).toEqual([]);
      });
    });

    describe('Gateway forwarded headers & internal services', () => {
      it('should authenticate internal service via x-internal-service with default roles', () => {
        req.headers['x-internal-service'] = 'payment-service';

        authenticate(req, res, next);

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(req.user).toEqual({
          id: 'system-internal',
          email: 'payment-service@ecommerce.internal',
          displayName: 'payment-service',
          roles: ['system', 'admin'],
        });
        expect(next).toHaveBeenCalledTimes(1);
      });

      it('should authenticate internal service with custom x-user-roles and x-user-id', () => {
        req.headers['x-internal-service'] = 'inventory-service';
        req.headers['x-user-id'] = 'custom-internal-id';
        req.headers['x-user-email'] = 'inventory@custom.domain';
        req.headers['x-user-name'] = 'Inventory Worker';
        req.headers['x-user-roles'] = 'Worker, System';

        authenticate(req, res, next);

        expect(req.user).toEqual({
          id: 'custom-internal-id',
          email: 'inventory@custom.domain',
          displayName: 'Inventory Worker',
          roles: ['worker', 'system'],
        });
        expect(next).toHaveBeenCalledTimes(1);
      });

      it('should authenticate user from gateway forwarded headers (x-user-id)', () => {
        req.headers['x-user-id'] = 'gw-user-555';
        req.headers['x-user-email'] = 'gw@example.com';
        req.headers['x-user-name'] = 'Gateway User';
        req.headers['x-user-roles'] = 'Customer, Seller';

        authenticate(req, res, next);

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(req.user).toEqual({
          id: 'gw-user-555',
          email: 'gw@example.com',
          displayName: 'Gateway User',
          roles: ['customer', 'seller'],
        });
        expect(next).toHaveBeenCalledTimes(1);
      });

      it('should handle gateway headers with missing optional fields gracefully', () => {
        req.headers['x-user-id'] = 'gw-user-minimal';

        authenticate(req, res, next);

        expect(req.user).toEqual({
          id: 'gw-user-minimal',
          email: '',
          displayName: '',
          roles: [],
        });
        expect(next).toHaveBeenCalledTimes(1);
      });
    });

    describe('Unauthenticated and Error scenarios', () => {
      it('should set req.user to null and proceed when no token or headers are provided', () => {
        authenticate(req, res, next);

        expect(jwt.verify).not.toHaveBeenCalled();
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalledTimes(1);
      });

      it('should set req.user to null and proceed when jwt.verify throws error', () => {
        req.cookies.accessToken = 'expired-token';
        jwt.verify.mockImplementationOnce(() => {
          throw new Error('jwt expired');
        });

        authenticate(req, res, next);

        expect(jwt.verify).toHaveBeenCalled();
        expect(req.user).toBeNull();
        expect(next).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('requireAuth', () => {
    it('should return 401 when req.user is null or undefined', () => {
      req.user = null;

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required. Please log in to place or manage orders.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when req.user exists but req.user.id is missing', () => {
      req.user = { email: 'noid@example.com' };

      requireAuth(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required. Please log in to place or manage orders.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next when req.user has a valid id', () => {
      req.user = { id: 'usr-valid-123', email: 'valid@example.com' };

      requireAuth(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireRole', () => {
    it('should return 401 when req.user is missing', () => {
      req.user = null;
      const roleMiddleware = requireRole(['admin']);

      roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 401 when req.user.id is missing', () => {
      req.user = { roles: ['admin'] };
      const roleMiddleware = requireRole(['admin']);

      roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Authentication required.',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should return 403 when user roles do not match allowed roles', () => {
      req.user = { id: 'usr-300', roles: ['customer'] };
      const roleMiddleware = requireRole(['admin', 'seller']);

      roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden: This action requires one of the following roles: [admin, seller]',
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should match roles case-insensitively and call next', () => {
      req.user = { id: 'usr-301', roles: ['admin'] };
      const roleMiddleware = requireRole(['Admin', 'Seller']);

      roleMiddleware(req, res, next);

      expect(res.status).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should handle undefined req.user.roles gracefully and return 403', () => {
      req.user = { id: 'usr-302' }; // roles undefined
      const roleMiddleware = requireRole(['admin']);

      roleMiddleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Forbidden: This action requires one of the following roles: [admin]',
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('Default export', () => {
    it('should export authenticate, requireAuth, and requireRole on default object', () => {
      expect(authModule.default).toBeDefined();
      expect(authModule.default.authenticate).toBe(authenticate);
      expect(authModule.default.requireAuth).toBe(requireAuth);
      expect(authModule.default.requireRole).toBe(requireRole);
    });
  });
});
