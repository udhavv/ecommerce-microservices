import { jest } from '@jest/globals';

jest.unstable_mockModule('../../services/inventory.service.js', () => ({
  default: {
    isOrderReserved: jest.fn(),
    reserveStock: jest.fn(),
    confirmReservation: jest.fn(),
    releaseReservation: jest.fn(),
    createInventoryItem: jest.fn(),
  },
}));

jest.unstable_mockModule('../../config/db.js', () => ({
  query: jest.fn(),
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const { default: inventoryService } = await import('../../services/inventory.service.js');
const { query } = await import('../../config/db.js');
const { handleOrderEvent } = await import('../../events/consumers/order.consumer.js');
const { handleProductEvent } = await import('../../events/consumers/product.consumer.js');

describe('Event Consumers Unit Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('order.consumer - handleOrderEvent', () => {
    it('should reserve stock for order.created when not already reserved', async () => {
      inventoryService.isOrderReserved.mockResolvedValueOnce(false);
      inventoryService.reserveStock.mockResolvedValueOnce({ status: 'RESERVED' });

      const eventPayload = {
        event: 'order.created',
        order_id: 'ord-100',
        order_number: 'ORD-2026-100',
        items: [{ variant_id: 1, quantity: 2 }],
      };

      await handleOrderEvent(eventPayload);

      expect(inventoryService.isOrderReserved).toHaveBeenCalledWith('ORD-2026-100', 'ord-100');
      expect(inventoryService.reserveStock).toHaveBeenCalledWith(
        'ORD-2026-100',
        eventPayload.items,
        15,
        null,
        'ord-100'
      );
    });

    it('should skip duplicate reservation if stock was already reserved during checkout', async () => {
      inventoryService.isOrderReserved.mockResolvedValueOnce(true);

      const eventPayload = {
        event: 'order.created',
        order_id: 'ord-101',
        items: [{ variant_id: 1, quantity: 2 }],
      };

      await handleOrderEvent(eventPayload);

      expect(inventoryService.reserveStock).not.toHaveBeenCalled();
    });

    it('should confirm reservation when receiving order.paid event', async () => {
      inventoryService.confirmReservation.mockResolvedValueOnce({ status: 'CONFIRMED' });

      const eventPayload = {
        event: 'order.paid',
        order_id: 'ord-200',
        order_number: 'ORD-200',
      };

      await handleOrderEvent(eventPayload);

      expect(inventoryService.confirmReservation).toHaveBeenCalledWith('ORD-200', 'ord-200');
    });

    it('should release reservation when receiving order.cancelled event', async () => {
      inventoryService.releaseReservation.mockResolvedValueOnce({ status: 'RELEASED' });

      const eventPayload = {
        event: 'order.cancelled',
        order_id: 'ord-300',
        order_number: 'ORD-300',
        reason: 'Payment timeout',
        items: [{ variant_id: 5, quantity: 1 }],
      };

      await handleOrderEvent(eventPayload);

      expect(inventoryService.releaseReservation).toHaveBeenCalledWith(
        'ORD-300',
        'Payment timeout',
        eventPayload.items,
        'ord-300'
      );
    });
  });

  describe('product.consumer - handleProductEvent', () => {
    it('should auto-create inventory items for all variants on product.created', async () => {
      inventoryService.createInventoryItem.mockResolvedValue({ id: 1 });

      const eventPayload = {
        event: 'product.created',
        product: {
          id: 50,
          seller_id: 'seller-uuid-1',
          variants: [
            { id: 101, sku: 'SKU-1', initial_stock: 20, low_stock_threshold: 5 },
            { id: 102, sku: 'SKU-2' }, // Uses defaults
          ],
        },
      };

      await handleProductEvent(eventPayload);

      expect(inventoryService.createInventoryItem).toHaveBeenCalledTimes(2);
      expect(inventoryService.createInventoryItem).toHaveBeenNthCalledWith(
        1,
        {
          product_id: 50,
          variant_id: 101,
          sku: 'SKU-1',
          quantity_available: 20,
          low_stock_threshold: 5,
        },
        'seller-uuid-1'
      );
      expect(inventoryService.createInventoryItem).toHaveBeenNthCalledWith(
        2,
        {
          product_id: 50,
          variant_id: 102,
          sku: 'SKU-2',
          quantity_available: 10,
          low_stock_threshold: 5,
        },
        'seller-uuid-1'
      );
    });

    it('should deactivate inventory items on product.deleted', async () => {
      query.mockResolvedValueOnce({ rowCount: 2 });

      const eventPayload = {
        event: 'product.deleted',
        productId: 50,
      };

      await handleProductEvent(eventPayload);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE inventory SET is_active = FALSE, updated_at = NOW() WHERE product_id = $1'),
        [50]
      );
    });
  });
});
