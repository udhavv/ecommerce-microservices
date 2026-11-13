import { jest } from '@jest/globals';
import { AppError } from '../../middleware/errorHandler.js';

jest.unstable_mockModule('../../config/env.js', () => ({
  default: {
    services: {
      inventoryUrl: 'http://inventory-service:4002/api',
    },
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { default: inventoryClient } = await import('../../services/inventory.client.js');

describe('Inventory Client Unit Tests (Orders Service)', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn();
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  describe('reserveStock', () => {
    it('should successfully reserve stock and return reservation data', async () => {
      const mockReservation = { id: 10, status: 'RESERVED' };
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          data: { reservation: mockReservation },
        }),
      });

      const user = { id: 'usr-1', email: 'user@example.com' };
      const items = [{ variant_id: 101, quantity: 2 }];

      const result = await inventoryClient.reserveStock('ORD-123', items, 15, user, 'token-abc');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://inventory-service:4002/api/inventory/reserve',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'x-internal-service': 'order-service',
            'x-user-id': 'usr-1',
            Authorization: 'Bearer token-abc',
          }),
          body: JSON.stringify({
            order_id: 'ORD-123',
            items: [{ variant_id: 101, quantity: 2 }],
            expires_in_minutes: 15,
            idempotency_key: 'reserve-ORD-123',
          }),
        })
      );
      expect(result).toEqual(mockReservation);
    });

    it('should throw AppError 400 when inventory responds with 4xx rejection', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: 'Insufficient stock for variant #101' }),
      });

      await expect(
        inventoryClient.reserveStock('ORD-123', [{ variant_id: 101, quantity: 999 }])
      ).rejects.toThrow('Insufficient stock for variant #101');
    });

    it('should throw AppError 502 when inventory responds with 500 error', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => ({ message: 'Database connection failed' }),
      });

      await expect(
        inventoryClient.reserveStock('ORD-123', [{ variant_id: 101, quantity: 1 }])
      ).rejects.toMatchObject({
        statusCode: 502,
        message: 'Database connection failed',
      });
    });

    it('should throw AppError 503 when network request fails', async () => {
      global.fetch.mockRejectedValueOnce(new Error('ECONNREFUSED'));

      await expect(
        inventoryClient.reserveStock('ORD-123', [{ variant_id: 101, quantity: 1 }])
      ).rejects.toMatchObject({
        statusCode: 503,
      });
    });
  });

  describe('confirmReservation', () => {
    it('should confirm reservation and return response body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Confirmed' }),
      });

      const result = await inventoryClient.confirmReservation('ORD-123', null, '123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://inventory-service:4002/api/inventory/confirm',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            order_id: 'ORD-123',
            order_number: '123',
          }),
        })
      );
      expect(result).toEqual({ success: true, message: 'Confirmed' });
    });

    it('should catch network errors and return null without throwing', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await inventoryClient.confirmReservation('ORD-123');
      expect(result).toBeNull();
    });
  });

  describe('releaseReservation', () => {
    it('should release reservation and return response body', async () => {
      global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true, message: 'Released' }),
      });

      const items = [{ variant_id: 5, quantity: 1 }];
      const result = await inventoryClient.releaseReservation('ORD-123', 'Cancelled by buyer', items, '123');

      expect(global.fetch).toHaveBeenCalledWith(
        'http://inventory-service:4002/api/inventory/release',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            order_id: 'ORD-123',
            order_number: '123',
            reason: 'Cancelled by buyer',
            items,
          }),
        })
      );
      expect(result).toEqual({ success: true, message: 'Released' });
    });

    it('should catch network errors and return null without throwing', async () => {
      global.fetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await inventoryClient.releaseReservation('ORD-123');
      expect(result).toBeNull();
    });
  });
});
