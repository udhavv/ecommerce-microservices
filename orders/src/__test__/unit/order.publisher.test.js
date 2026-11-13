import { jest } from '@jest/globals';

jest.unstable_mockModule('../../config/rabbitmq.js', () => ({
  default: {
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

const { default: rabbitmq } = await import('../../config/rabbitmq.js');
const { default: orderPublisher } = await import('../../events/publishers/order.publisher.js');

describe('Order Publisher Unit Tests (Orders Service)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    rabbitmq.publish.mockResolvedValue(true);
  });

  const mockOrder = {
    id: 10,
    order_number: 'ORD-20261102-XYZ',
    user_id: 'usr-123',
    customer_email: 'buyer@example.com',
    customer_name: 'Buyer Name',
    total_amount: '99.99',
    currency: 'USD',
    payment_status: 'PAID',
    items: [
      {
        product_id: 1,
        variant_id: 101,
        quantity: 2,
        sku: 'SKU-001',
        unit_price: '49.99',
      },
    ],
  };

  describe('publishOrderCreated', () => {
    it('should format payload and publish order.created event', async () => {
      await orderPublisher.publishOrderCreated(mockOrder);

      expect(rabbitmq.publish).toHaveBeenCalledWith(
        'order.created',
        expect.objectContaining({
          event: 'order.created',
          order_id: '10',
          order_number: 'ORD-20261102-XYZ',
          user_id: 'usr-123',
          total_amount: '99.99',
          items: [
            {
              product_id: 1,
              variant_id: 101,
              quantity: 2,
              sku: 'SKU-001',
              unit_price: '49.99',
            },
          ],
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('publishOrderPaid', () => {
    it('should format payload and publish order.paid event', async () => {
      await orderPublisher.publishOrderPaid(mockOrder);

      expect(rabbitmq.publish).toHaveBeenCalledWith(
        'order.paid',
        expect.objectContaining({
          event: 'order.paid',
          order_id: '10',
          order_number: 'ORD-20261102-XYZ',
          payment_status: 'PAID',
          items: [
            {
              variant_id: 101,
              quantity: 2,
            },
          ],
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('publishOrderCancelled', () => {
    it('should format payload and publish order.cancelled event', async () => {
      await orderPublisher.publishOrderCancelled(mockOrder, 'Out of stock');

      expect(rabbitmq.publish).toHaveBeenCalledWith(
        'order.cancelled',
        expect.objectContaining({
          event: 'order.cancelled',
          order_id: '10',
          order_number: 'ORD-20261102-XYZ',
          reason: 'Out of stock',
          items: [
            {
              variant_id: 101,
              quantity: 2,
            },
          ],
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('publishOrderStatusUpdated', () => {
    it('should format payload and publish order.status_updated event', async () => {
      await orderPublisher.publishOrderStatusUpdated(
        mockOrder,
        'CONFIRMED',
        'PROCESSING',
        'Warehouse packing started'
      );

      expect(rabbitmq.publish).toHaveBeenCalledWith(
        'order.status_updated',
        expect.objectContaining({
          event: 'order.status_updated',
          order_id: '10',
          order_number: 'ORD-20261102-XYZ',
          previous_status: 'CONFIRMED',
          new_status: 'PROCESSING',
          reason: 'Warehouse packing started',
          timestamp: expect.any(String),
        })
      );
    });
  });
});
