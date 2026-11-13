import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/db.js', () => ({
  query: jest.fn(),
  withTransaction: jest.fn(),
}));

const { query } = await import('../../config/db.js');
const { idempotencyService } = await import('../../services/idempotency.service.js');

describe('IdempotencyService Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  describe('hashPayload', () => {
    it('should generate a deterministic SHA-256 hash for identical payloads', () => {
      const payload1 = { order_id: 'ord-123', items: [{ variant_id: 1, quantity: 2 }] };
      const payload2 = { order_id: 'ord-123', items: [{ variant_id: 1, quantity: 2 }] };

      const hash1 = idempotencyService.hashPayload(payload1);
      const hash2 = idempotencyService.hashPayload(payload2);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
    });

    it('should handle null or undefined payloads without throwing', () => {
      const hashNull = idempotencyService.hashPayload(null);
      const hashEmpty = idempotencyService.hashPayload({});

      expect(hashNull).toBe(hashEmpty);
    });
  });

  describe('getRecord', () => {
    it('should return null immediately if key is not provided', async () => {
      const result = await idempotencyService.getRecord(null);
      expect(result).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    it('should return the record if found and not expired', async () => {
      const mockRecord = {
        idempotency_key: 'key-123',
        response_status: 200,
        response_body: { success: true },
      };
      query.mockResolvedValueOnce({ rows: [mockRecord] });

      const result = await idempotencyService.getRecord('key-123');

      expect(query).toHaveBeenCalledWith(
        expect.stringMatching(/SELECT\s+\*\s+FROM\s+inventory_idempotency\s+WHERE\s+idempotency_key\s+=\s+\$1/),
        ['key-123']
      );
      expect(result).toEqual(mockRecord);
    });

    it('should return null if record is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await idempotencyService.getRecord('non-existent-key');
      expect(result).toBeNull();
    });
  });

  describe('saveRecord', () => {
    it('should return null if key is missing', async () => {
      const result = await idempotencyService.saveRecord(null, 'hash123', 200, { ok: true });
      expect(result).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    it('should upsert the idempotency record into database', async () => {
      const savedRecord = {
        idempotency_key: 'key-abc',
        request_hash: 'hash-xyz',
        response_status: 200,
        response_body: '{"success":true}',
      };
      query.mockResolvedValueOnce({ rows: [savedRecord] });

      const result = await idempotencyService.saveRecord(
        'key-abc',
        'hash-xyz',
        200,
        { success: true },
        30
      );

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO inventory_idempotency'),
        ['key-abc', 'hash-xyz', 200, '{"success":true}', expect.any(Date)]
      );
      expect(result).toEqual(savedRecord);
    });
  });
});
