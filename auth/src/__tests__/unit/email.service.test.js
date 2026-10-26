import { jest } from '@jest/globals';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
  getTransporter,
} from '../../services/email.service.js';

describe('Email Service', () => {
  it('should return mock transporter in test mode', () => {
    const transporter = getTransporter();
    expect(transporter).toBeDefined();
    expect(typeof transporter.sendMail).toBe('function');
  });

  it('should send verification email without error', async () => {
    const result = await sendVerificationEmail({
      to: 'test@example.com',
      displayName: 'Test User',
      token: 'sample-verification-token',
    });

    expect(result).toBeDefined();
    expect(result.messageId).toContain('mock-mail-id');
  });

  it('should send password reset email without error', async () => {
    const result = await sendPasswordResetEmail({
      to: 'test@example.com',
      displayName: 'Test User',
      token: 'sample-reset-token',
    });

    expect(result).toBeDefined();
    expect(result.messageId).toContain('mock-mail-id');
  });
});
