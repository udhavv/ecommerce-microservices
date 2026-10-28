import { jest } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import env from '../../config/env.js';
import { mockPool, resetDatabase, tables } from '../helpers/mock-db.js';

let lastSentVerificationToken = null;
let lastSentResetToken = null;

const mockEmailService = {
  sendVerificationEmail: jest.fn(async ({ token }) => {
    lastSentVerificationToken = token;
    return { messageId: 'verify-mock-id' };
  }),
  sendPasswordResetEmail: jest.fn(async ({ token }) => {
    lastSentResetToken = token;
    return { messageId: 'reset-mock-id' };
  }),
};

// Register module mocks
jest.unstable_mockModule('../../config/db.js', () => ({
  pool: mockPool,
}));

jest.unstable_mockModule('../../services/email.service.js', () => mockEmailService);

// Import app after mocks are in place
const { default: app } = await import('../../index.js');

describe('Auth Microservice - End-to-End Integration Tests', () => {
  beforeEach(() => {
    resetDatabase();
    jest.clearAllMocks();
    lastSentVerificationToken = null;
    lastSentResetToken = null;
  });

  const testUser = {
    email: 'johndoe@example.com',
    password: 'Password123!',
    displayName: 'John Doe',
  };

  describe('1. User Registration & Email Dispatch', () => {
    it('POST /api/auth/register should create user and trigger verification email', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send(testUser);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Please check your email for the verification link');
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.status).toBe('pending');
      expect(res.body.data.user.emailVerifiedAt).toBeNull();

      // Check email service was called
      expect(mockEmailService.sendVerificationEmail).toHaveBeenCalledTimes(1);
      expect(lastSentVerificationToken).toBeDefined();
    });

    it('POST /api/auth/register should reject duplicate email with 409', async () => {
      await request(app).post('/api/auth/register').send(testUser);
      const res = await request(app).post('/api/auth/register').send(testUser);

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain('already exists');
    });

    it('POST /api/auth/register should reject weak password with 400', async () => {
      const res = await request(app).post('/api/auth/register').send({
        email: 'weak@example.com',
        password: 'weak',
        displayName: 'Weak User',
      });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('2. Unverified User Cannot Log In', () => {
    it('POST /api/auth/login should block unverified user with 403', async () => {
      await request(app).post('/api/auth/register').send(testUser);

      const res = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      expect(res.status).toBe(403);
      expect(res.body.message).toContain('Account is not active or email is not verified');
    });
  });

  describe('3. Email Verification Flow', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
    });

    it('GET /api/auth/verify-email?token=... (Email Button Click) should verify email and render HTML success page', async () => {
      const res = await request(app)
        .get(`/api/auth/verify-email?token=${lastSentVerificationToken}`)
        .set('Accept', 'text/html');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Email Verified!');
      expect(res.text).toContain('Proceed to Login');
    });

    it('POST /api/auth/verify-email should verify email via JSON API', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: lastSentVerificationToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('Email verified successfully');
      expect(res.body.data.user.status).toBe('active');
      expect(res.body.data.user.emailVerifiedAt).not.toBeNull();
    });

    it('POST /api/auth/verify-email should reject invalid token with 400', async () => {
      const res = await request(app)
        .post('/api/auth/verify-email')
        .send({ token: 'invalid-nonexistent-token' });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain('Invalid verification token');
    });

    it('POST /api/auth/verify-email should reject already-used token', async () => {
      // First verification succeeds
      await request(app).post('/api/auth/verify-email').send({ token: lastSentVerificationToken });

      // Second attempt fails
      const res = await request(app).post('/api/auth/verify-email').send({ token: lastSentVerificationToken });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain('already been used');
    });
  });

  describe('4. Login & Verified Profile Data via GET Request', () => {
    let accessToken;
    let refreshToken;

    beforeEach(async () => {
      // Register and verify user
      await request(app).post('/api/auth/register').send(testUser);
      await request(app).post('/api/auth/verify-email').send({ token: lastSentVerificationToken });

      // Login
      const loginRes = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });

      const cookies = loginRes.headers['set-cookie'] || [];
      const accessCookie = cookies.find((c) => c.startsWith('accessToken='));
      const refreshCookie = cookies.find((c) => c.startsWith('refreshToken='));

      accessToken = accessCookie ? accessCookie.split(';')[0].replace('accessToken=', '') : null;
      refreshToken = refreshCookie ? refreshCookie.split(';')[0].replace('refreshToken=', '') : null;
    });

    it('GET /api/auth/profile should successfully retrieve user profile with access token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.email).toBe(testUser.email);
      expect(res.body.data.user.displayName).toBe(testUser.displayName);
      expect(res.body.data.user.status).toBe('active');
      expect(res.body.data.user.emailVerifiedAt).not.toBeNull();
    });

    it('GET /api/auth/profile should accept lowercase "bearer" token', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/auth/profile should accept accessToken from cookies', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Cookie', [`accessToken=${accessToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('GET /api/auth/profile should reject requests without token with 401', async () => {
      const res = await request(app).get('/api/auth/profile');
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access token is required');
    });

    it('GET /api/auth/profile should reject invalid token with 401', async () => {
      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', 'Bearer bad.token.here');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid access token');
    });

    it('GET /api/auth/profile should transparently recover when accessToken is expired if refreshToken is present', async () => {
      const expiredToken = jwt.sign({ id: 'u-1', sub: 'u-1' }, env.jwt.accessSecret, {
        expiresIn: '-60s',
      });

      const res = await request(app)
        .get('/api/auth/profile')
        .set('Authorization', `Bearer ${expiredToken}`)
        .set('Cookie', [`refreshToken=${refreshToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['x-access-token']).toBeDefined();
    });

    it('POST /api/auth/refresh should issue new tokens', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
      const cookies = res.headers['set-cookie'];
      expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
      expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
    });

    it('POST /api/auth/logout should revoke session and log out', async () => {
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .set('Cookie', [`refreshToken=${refreshToken}`])
        .send({ refreshToken });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('Logged out successfully');
    });
  });

  describe('5. Forgot Password & Reset Password Workflow', () => {
    beforeEach(async () => {
      await request(app).post('/api/auth/register').send(testUser);
      await request(app).post('/api/auth/verify-email').send({ token: lastSentVerificationToken });
    });

    it('POST /api/auth/forgot-password should send reset email', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: testUser.email });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('password reset instructions have been sent');
      expect(mockEmailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
      expect(lastSentResetToken).toBeDefined();
    });

    it('POST /api/auth/forgot-password should return success for unknown email (prevent enumeration)', async () => {
      const res = await request(app)
        .post('/api/auth/forgot-password')
        .send({ email: 'ghost@example.com' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain('password reset instructions have been sent');
      expect(mockEmailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('POST /api/auth/reset-password should change password and allow login with new password', async () => {
      // Request reset
      await request(app).post('/api/auth/forgot-password').send({ email: testUser.email });
      const resetToken = lastSentResetToken;

      const newPassword = 'NewSecretPassword99!';

      // Reset password
      const resetRes = await request(app).post('/api/auth/reset-password').send({
        token: resetToken,
        newPassword,
      });

      expect(resetRes.status).toBe(200);
      expect(resetRes.body.success).toBe(true);
      expect(resetRes.body.message).toContain('Password has been reset successfully');

      // Login with old password must fail
      const oldLoginRes = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: testUser.password,
      });
      expect(oldLoginRes.status).toBe(401);

      // Login with new password must succeed
      const newLoginRes = await request(app).post('/api/auth/login').send({
        email: testUser.email,
        password: newPassword,
      });
      expect(newLoginRes.status).toBe(200);
      expect(newLoginRes.headers['set-cookie']).toBeDefined();
      const newCookies = newLoginRes.headers['set-cookie'];
      expect(newCookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    });
  });
});
