import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/db.js', () => ({
  query: jest.fn(),
}));

jest.unstable_mockModule('../../services/inventory.client.js', () => ({
  default: {
    confirmReservation: jest.fn().mockResolvedValue({ success: true }),
    releaseReservation: jest.fn().mockResolvedValue({ success: true }),
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

const { query } = await import('../../config/db.js');
const { default: inventoryClient } = await import('../../services/inventory.client.js');
const { handleInventoryEvent } = await import('../../events/consumers/inventory.consumer.js');
const { handlePaymentEvent } = await import('../../events/consumers/payment.consumer.js');

describe('Event Consumers Unit Tests (Orders Service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('inventory.consumer - handleInventoryEvent', () => {
    it('should mark order as FAILED on inventory.reservation_failed event', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 10 }] }); // update order
      query.mockResolvedValueOnce({ rows: [] }); // insert history

      const eventPayload = {
        event: 'inventory.reservation_failed',
        order_id: '10',
        reason: 'Out of stock for variant 5',
      };

      await handleInventoryEvent(eventPayload);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("SET status = 'FAILED'"),
        ['10']
      );
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO order_status_history'),
        [10, 'Out of stock for variant 5']
      );
    });

    it('should ignore events other than inventory.reservation_failed', async () => {
      const eventPayload = {
        event: 'inventory.item_updated',
        order_id: '10',
      };

      await handleInventoryEvent(eventPayload);

      expect(query).not.toHaveBeenCalled();
    });

    it('should handle database errors without throwing', async () => {
      query.mockRejectedValueOnce(new Error('DB failure'));

      const eventPayload = {
        event: 'inventory.reservation_failed',
        order_id: '10',
      };

      await expect(handleInventoryEvent(eventPayload)).resolves.toBeUndefined();
    });
  });

  describe('payment.consumer - handlePaymentEvent', () => {
    it('should confirm order and call inventoryClient on payment.successful event', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 20, order_number: 'ORD-20' }] }); // update order
      query.mockResolvedValueOnce({ rows: [] }); // insert history

      const eventPayload = {
        event: 'payment.successful',
        order_id: '20',
        payment_reference: 'ch_123456789',
      };

      await handlePaymentEvent(eventPayload);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining("SET payment_status = 'PAID', \n             status = 'CONFIRMED'"),
        ['20']
      );
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO order_status_history'),
        [20, 'Payment verified (ch_123456789)']
      );
      expect(inventoryClient.confirmReservation).toHaveBeenCalledWith('ORD-20', null, '20');
    });

    it('should record declined status history on payment.failed event', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 30 }] }); // find order
      query.mockResolvedValueOnce({ rows: [] }); // insert history

      const eventPayload = {
        event: 'payment.failed',
        order_id: '30',
        error_code: 'INSUFFICIENT_FUNDS',
      };

      await handlePaymentEvent(eventPayload);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT id FROM orders'),
        ['30']
      );
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('INSERT INTO order_status_history'),
        [30, 'Payment attempt declined (INSUFFICIENT_FUNDS)']
      );
      expect(inventoryClient.confirmReservation).not.toHaveBeenCalled();
    });

    it('should ignore events other than payment.successful or payment.failed', async () => {
      const eventPayload = {
        event: 'payment.refunded',
        order_id: '30',
      };

      await handlePaymentEvent(eventPayload);

      expect(query).not.toHaveBeenCalled();
    });

    it('should handle database exceptions gracefully without unhandled rejection', async () => {
      query.mockRejectedValueOnce(new Error('Database lock error'));

      const eventPayload = {
        event: 'payment.successful',
        order_id: '40',
      };

      await expect(handlePaymentEvent(eventPayload)).resolves.toBeUndefined();
    });
  });
});
