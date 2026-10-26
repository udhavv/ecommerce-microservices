import { generateAccessToken, verifyAccessToken, generateRefreshToken, getRefreshTokenExpiry } from '../../utils/token.js';

describe('Token Utilities', () => {
  const mockPayload = {
    userId: 'user-123',
    email: 'test@example.com',
    role: 'USER',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', () => {
      const token = generateAccessToken(mockPayload);
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });

    it('should contain the correct payload when decoded', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe(mockPayload.userId);
      expect(decoded.email).toBe(mockPayload.email);
      expect(decoded.role).toBe(mockPayload.role);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid token', () => {
      const token = generateAccessToken(mockPayload);
      const decoded = verifyAccessToken(token);
      expect(decoded.userId).toBe('user-123');
    });

    it('should throw on an invalid token', () => {
      expect(() => verifyAccessToken('invalid.token.here')).toThrow();
    });

    it('should throw on a tampered token', () => {
      const token = generateAccessToken(mockPayload);
      const tampered = token.slice(0, -5) + 'xxxxx';
      expect(() => verifyAccessToken(tampered)).toThrow();
    });
  });

  describe('generateRefreshToken', () => {
    it('should generate an 80-character hex string', () => {
      const token = generateRefreshToken();
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token).toHaveLength(80); // 40 bytes = 80 hex chars
    });

    it('should generate unique tokens each time', () => {
      const token1 = generateRefreshToken();
      const token2 = generateRefreshToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe('getRefreshTokenExpiry', () => {
    it('should return a Date in the future', () => {
      const expiry = getRefreshTokenExpiry();
      expect(expiry).toBeInstanceOf(Date);
      expect(expiry.getTime()).toBeGreaterThan(Date.now());
    });
  });
});
