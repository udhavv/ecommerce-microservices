import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/db.js', () => ({
  query: jest.fn(),
}));

jest.unstable_mockModule('../../config/rabbitmq.js', () => ({
  default: {
    isConnected: true,
    publish: jest.fn(),
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
const { default: rabbitmq } = await import('../../config/rabbitmq.js');
const { default: outboxService } = await import('../../services/outbox.service.js');

describe('Outbox Service Unit Tests (Orders Service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rabbitmq.isConnected = true;
  });

  describe('recordEvent', () => {
    it('should insert an outbox event using provided pg transaction client', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({
          rows: [{ id: 1, event_id: 'mock-uuid-v4' }],
        }),
      };

      const result = await outboxService.recordEvent(
        mockClient,
        'Order',
        100,
        'order.created',
        { order_number: 'ORD-100' }
      );

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO outbox_events'),
        [
          expect.any(String), // UUID generated
          'Order',
          100,
          'order.created',
          { order_number: 'ORD-100' },
        ]
      );
      expect(result).toEqual({ id: 1, event_id: 'mock-uuid-v4' });
    });
  });

  describe('dispatchPendingEvents', () => {
    it('should skip dispatching if rabbitmq is not connected', async () => {
      rabbitmq.isConnected = false;

      await outboxService.dispatchPendingEvents();

      expect(query).not.toHaveBeenCalled();
      expect(rabbitmq.publish).not.toHaveBeenCalled();
    });

    it('should do nothing if no pending outbox events exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await outboxService.dispatchPendingEvents();

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE published_at IS NULL')
      );
      expect(rabbitmq.publish).not.toHaveBeenCalled();
    });

    it('should publish pending events and mark them as published upon success', async () => {
      const mockEvents = [
        {
          id: 1,
          event_id: 'evt-101',
          event_type: 'order.created',
          payload: { order_id: '101' },
        },
      ];
      query.mockResolvedValueOnce({ rows: mockEvents }); // fetch
      rabbitmq.publish.mockResolvedValueOnce(true); // publish
      query.mockResolvedValueOnce({ rowCount: 1 }); // update

      await outboxService.dispatchPendingEvents();

      expect(rabbitmq.publish).toHaveBeenCalledWith('order.created', { order_id: '101' }, {
        messageId: 'evt-101',
      });
      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SET published_at = NOW()'),
        [1]
      );
    });

    it('should schedule retry when rabbitmq publish returns false or throws', async () => {
      const mockEvents = [
        {
          id: 2,
          event_id: 'evt-102',
          event_type: 'order.paid',
          payload: { order_id: '102' },
        },
      ];
      query.mockResolvedValueOnce({ rows: mockEvents }); // fetch
      rabbitmq.publish.mockRejectedValueOnce(new Error('Connection lost')); // publish error
      query.mockResolvedValueOnce({ rowCount: 1 }); // retry update

      await outboxService.dispatchPendingEvents();

      expect(query).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('SET attempts = attempts + 1'),
        ['Connection lost', 2]
      );
    });

    it('should catch top-level database query errors gracefully', async () => {
      query.mockRejectedValueOnce(new Error('DB unreachable'));

      await expect(outboxService.dispatchPendingEvents()).resolves.toBeUndefined();
    });
  });

  describe('startWorker', () => {
    it('should start an interval timer and return a teardown function', () => {
      jest.useFakeTimers();
      const spyDispatch = jest.spyOn(outboxService, 'dispatchPendingEvents').mockResolvedValue();

      const stopWorker = outboxService.startWorker(2000);

      jest.advanceTimersByTime(2100);
      expect(spyDispatch).toHaveBeenCalledTimes(1);

      stopWorker();
      jest.advanceTimersByTime(2100);
      expect(spyDispatch).toHaveBeenCalledTimes(1); // not called again

      jest.useRealTimers();
    });
  });
});
