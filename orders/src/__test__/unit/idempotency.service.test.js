import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/db.js', () => ({
  query: jest.fn(),
}));

const { query } = await import('../../config/db.js');
const { default: idempotencyService } = await import('../../services/idempotency.service.js');

describe('Idempotency Service Unit Tests (Orders Service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('findOrderByKey', () => {
    it('should return null immediately if idempotencyKey is not provided', async () => {
      const resultNull = await idempotencyService.findOrderByKey(null);
      const resultEmpty = await idempotencyService.findOrderByKey('');

      expect(resultNull).toBeNull();
      expect(resultEmpty).toBeNull();
      expect(query).not.toHaveBeenCalled();
    });

    it('should return order with items when found by idempotency key', async () => {
      const mockOrder = {
        id: 10,
        order_number: 'ORD-20261102-ABC123',
        idempotency_key: 'idem-key-999',
        total_amount: '125.00',
        items: [
          {
            id: 1,
            product_id: 5,
            variant_id: 10,
            quantity: 2,
            unit_price: '50.00',
          },
        ],
      };
      query.mockResolvedValueOnce({ rows: [mockOrder] });

      const result = await idempotencyService.findOrderByKey('idem-key-999');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE o.idempotency_key = $1'),
        ['idem-key-999']
      );
      expect(result).toEqual(mockOrder);
    });

    it('should return null if no order matches the idempotency key', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      const result = await idempotencyService.findOrderByKey('unknown-idem-key');

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE o.idempotency_key = $1'),
        ['unknown-idem-key']
      );
      expect(result).toBeNull();
    });
  });
});
