import { jest } from '@jest/globals';
import bcrypt from 'bcrypt';

// Mock Client and Pool
const mockClient = {
  query: jest.fn(),
  release: jest.fn(),
};

const mockPool = {
  connect: jest.fn(async () => mockClient),
  query: jest.fn(),
  on: jest.fn(),
};

const mockEmailService = {
  sendVerificationEmail: jest.fn(async () => ({ messageId: 'mock-verify-id' })),
  sendPasswordResetEmail: jest.fn(async () => ({ messageId: 'mock-reset-id' })),
};

const mockAuditService = {
  logAuditEvent: jest.fn(async () => {}),
  AuditEvents: {
    USER_REGISTERED: 'user.registered',
    LOGIN_SUCCESS: 'user.login.success',
    LOGIN_FAILED: 'user.login.failed',
    LOGIN_BLOCKED: 'user.login.blocked',
    TOKEN_REFRESHED: 'user.token.refreshed',
    LOGOUT_SUCCESS: 'user.logout',
    EMAIL_VERIFIED: 'user.email.verified',
    PASSWORD_RESET_REQUESTED: 'user.password.reset.requested',
    PASSWORD_RESET_COMPLETED: 'user.password.reset.completed',
  },
};

// Register unstable ESM mocks
jest.unstable_mockModule('../../config/db.js', () => ({
  pool: mockPool,
}));

jest.unstable_mockModule('../../services/email.service.js', () => mockEmailService);
jest.unstable_mockModule('../../services/audit.service.js', () => mockAuditService);

// Dynamically import the service under test
const {
  registerUser,
  verifyUserEmail,
  forgotPassword,
  resetPassword,
  loginUser,
  getCurrentUser,
  AuthError,
} = await import('../../services/auth.service.js');

describe('Auth Service Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('registerUser', () => {
    it('should throw 400 if required fields are missing', async () => {
      await expect(
        registerUser({ email: '', password: '', displayName: '' }),
      ).rejects.toThrow(AuthError);
    });

    it('should throw 400 if password is shorter than 8 characters', async () => {
      await expect(
        registerUser({ email: 'test@example.com', password: 'short', displayName: 'Test' }),
      ).rejects.toThrow('Password must be at least 8 characters');
    });

    it('should register user, store verification token, and dispatch email', async () => {
      const mockCreatedUser = {
        id: 'u-123',
        email: 'test@example.com',
        display_name: 'Test User',
        status: 'pending',
        email_verified_at: null,
        created_at: new Date(),
      };

      mockClient.query.mockImplementation(async (sql, params) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO users')) {
          return { rows: [mockCreatedUser] };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles')) {
          return { rows: [{ name: 'user' }] };
        }
        return { rows: [] };
      });

      const user = await registerUser({
        email: 'test@example.com',
        password: 'Password123!',
        displayName: 'Test User',
      });

      expect(user).toBeDefined();
      expect(user.id).toBe('u-123');
      expect(user.email).toBe('test@example.com');
      expect(user.status).toBe('pending');
      expect(user.emailVerifiedAt).toBeNull();
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
    });

    it('should throw 409 if email already exists', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('INSERT INTO users')) {
          const err = new Error('duplicate key');
          err.code = '23505';
          throw err;
        }
        return { rows: [] };
      });

      await expect(
        registerUser({
          email: 'duplicate@example.com',
          password: 'Password123!',
          displayName: 'Duplicate User',
        }),
      ).rejects.toMatchObject({
        statusCode: 409,
        message: 'An account with this email already exists',
      });
    });
  });

  describe('verifyUserEmail', () => {
    it('should throw 400 if verification token is invalid', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM email_verification_tokens')) {
          return { rows: [] };
        }
        return { rows: [] };
      });

      await expect(verifyUserEmail('nonexistent-token')).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid verification token',
      });
    });

    it('should throw 400 if token was already used', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM email_verification_tokens')) {
          return {
            rows: [
              {
                id: 'evt-1',
                user_id: 'u-1',
                used_at: new Date(),
                expires_at: new Date(Date.now() + 100000),
              },
            ],
          };
        }
        return { rows: [] };
      });

      await expect(verifyUserEmail('used-token')).rejects.toMatchObject({
        statusCode: 400,
        message: 'This verification token has already been used',
      });
    });

    it('should activate user and verify email successfully', async () => {
      const mockUpdatedUser = {
        id: 'u-1',
        email: 'verified@example.com',
        display_name: 'Verified User',
        status: 'active',
        email_verified_at: new Date(),
        created_at: new Date(),
      };

      mockClient.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM email_verification_tokens')) {
          return {
            rows: [
              {
                id: 'evt-1',
                user_id: 'u-1',
                used_at: null,
                expires_at: new Date(Date.now() + 100000),
                email: 'verified@example.com',
                display_name: 'Verified User',
                status: 'pending',
              },
            ],
          };
        }
        if (typeof sql === 'string' && sql.includes('UPDATE users')) {
          return { rows: [mockUpdatedUser] };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles')) {
          return { rows: [{ name: 'user' }] };
        }
        return { rows: [] };
      });

      const user = await verifyUserEmail('valid-token');
      expect(user.status).toBe('active');
      expect(user.emailVerifiedAt).not.toBeNull();
    });
  });

  describe('forgotPassword', () => {
    it('should safely return success message even if user does not exist (prevents enumeration)', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      const res = await forgotPassword('nobody@example.com');
      expect(res.message).toContain('password reset instructions have been sent');
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should store reset token and dispatch reset email for valid user', async () => {
      mockPool.query.mockResolvedValue({
        rows: [{ id: 'u-1', email: 'user@example.com', display_name: 'User One', status: 'active' }],
      });
      mockClient.query.mockResolvedValue({ rows: [] });

      const res = await forgotPassword('user@example.com');
      expect(res.message).toContain('password reset instructions have been sent');
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('resetPassword', () => {
    it('should throw 400 if token is invalid', async () => {
      mockClient.query.mockResolvedValue({ rows: [] });

      await expect(
        resetPassword({ token: 'bad-token', newPassword: 'NewPassword123!' }),
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Invalid password reset token',
      });
    });

    it('should reset password, mark token used, and revoke sessions', async () => {
      mockClient.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM password_reset_tokens')) {
          return {
            rows: [
              {
                id: 'prt-1',
                user_id: 'u-1',
                used_at: null,
                expires_at: new Date(Date.now() + 100000),
                email: 'user@example.com',
                status: 'active',
              },
            ],
          };
        }
        return { rows: [] };
      });

      const res = await resetPassword({ token: 'good-token', newPassword: 'NewPassword123!' });
      expect(res.success).toBe(true);
      expect(res.message).toContain('Password has been reset successfully');
    });
  });

  describe('loginUser', () => {
    it('should throw 401 for unknown user', async () => {
      mockPool.query.mockResolvedValue({ rows: [] });

      await expect(
        loginUser({ email: 'ghost@example.com', password: 'Password123!' }),
      ).rejects.toMatchObject({
        statusCode: 401,
        message: 'Invalid email or password',
      });
    });

    it('should throw 403 if user is not verified or status is not active', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'u-unverified',
            email: 'unverified@example.com',
            password_hash: hash,
            display_name: 'Unverified',
            status: 'pending',
            email_verified_at: null,
          },
        ],
      });

      await expect(
        loginUser({ email: 'unverified@example.com', password: 'Password123!' }),
      ).rejects.toMatchObject({
        statusCode: 403,
        message: 'Account is not active or email is not verified',
      });
    });

    it('should return tokens and user when user is verified and active', async () => {
      const hash = await bcrypt.hash('Password123!', 10);
      mockPool.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'u-verified',
                email: 'verified@example.com',
                password_hash: hash,
                display_name: 'Verified',
                status: 'active',
                email_verified_at: new Date(),
                created_at: new Date(),
              },
            ],
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles')) {
          return { rows: [{ name: 'user' }] };
        }
        return { rows: [] };
      });

      const result = await loginUser({ email: 'verified@example.com', password: 'Password123!' });
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.user.email).toBe('verified@example.com');
    });
  });

  describe('getCurrentUser (Profile)', () => {
    it('should throw 403 if user is not verified', async () => {
      mockPool.query.mockResolvedValue({
        rows: [
          {
            id: 'u-unverified',
            email: 'unverified@example.com',
            display_name: 'Unverified',
            status: 'pending',
            email_verified_at: null,
          },
        ],
      });

      await expect(getCurrentUser('u-unverified')).rejects.toMatchObject({
        statusCode: 403,
        message: 'Account is not verified or inactive',
      });
    });

    it('should return profile for verified active user', async () => {
      mockPool.query.mockImplementation(async (sql) => {
        if (typeof sql === 'string' && sql.includes('FROM users')) {
          return {
            rows: [
              {
                id: 'u-active',
                email: 'active@example.com',
                display_name: 'Active User',
                status: 'active',
                email_verified_at: new Date(),
                created_at: new Date(),
              },
            ],
          };
        }
        if (typeof sql === 'string' && sql.includes('FROM roles')) {
          return { rows: [{ name: 'user' }] };
        }
        return { rows: [] };
      });

      const user = await getCurrentUser('u-active');
      expect(user.id).toBe('u-active');
      expect(user.email).toBe('active@example.com');
      expect(user.status).toBe('active');
    });
  });
});
