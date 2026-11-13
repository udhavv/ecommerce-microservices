import { jest } from '@jest/globals';
import { AppError } from '../../middleware/errorHandler.js';

jest.unstable_mockModule('../../config/db.js', () => ({
  query: jest.fn(),
  withTransaction: jest.fn((callback) => {
    const mockClient = {
      query: jest.fn(),
    };
    return callback(mockClient);
  }),
}));

jest.unstable_mockModule('../../events/publishers/inventory.publisher.js', () => ({
  default: {
    publishStockUpdated: jest.fn().mockResolvedValue(true),
    publishLowStock: jest.fn().mockResolvedValue(true),
    publishOutOfStock: jest.fn().mockResolvedValue(true),
    publishReservationSuccess: jest.fn().mockResolvedValue(true),
    publishReservationFailed: jest.fn().mockResolvedValue(true),
    publishReservationConfirmed: jest.fn().mockResolvedValue(true),
    publishReservationReleased: jest.fn().mockResolvedValue(true),
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

const { query, withTransaction } = await import('../../config/db.js');
const { default: inventoryPublisher } = await import('../../events/publishers/inventory.publisher.js');
const { inventoryService } = await import('../../services/inventory.service.js');

describe('InventoryService Unit Tests', () => {
  const mockSeller = { id: 'seller-100', roles: ['seller'] };
  const mockAdmin = { id: 'admin-999', roles: ['admin'] };

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  // =========================================================================
  // listInventory()
  // =========================================================================
  describe('listInventory', () => {
    it('should scope inventory query to seller ID for non-admin sellers', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1, seller_id: 'seller-100', sku: 'SKU-1' }] });

      const result = await inventoryService.listInventory({ page: 1, limit: 10 }, mockSeller);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('seller_id = $1'),
        ['seller-100']
      );
      expect(result.items).toHaveLength(1);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should allow admin to filter by specific seller_id', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({ rows: [{ id: 1 }, { id: 2 }] });

      await inventoryService.listInventory({ seller_id: 'seller-200' }, mockAdmin);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('seller_id = $1'),
        ['seller-200']
      );
    });

    it('should apply low_stock_only and search query conditions', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({ rows: [{ id: 5, sku: 'LOW-PHONE-1' }] });

      await inventoryService.listInventory(
        { low_stock_only: true, search: 'PHONE' },
        mockAdmin
      );

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/quantity_available <= low_stock_threshold.*sku ILIKE/s),
        ['%PHONE%']
      );
    });
  });

  // =========================================================================
  // getByVariantId()
  // =========================================================================
  describe('getByVariantId', () => {
    it('should return active inventory record for variant ID', async () => {
      const mockItem = { id: 1, variant_id: 101, quantity_available: 25 };
      query.mockResolvedValueOnce({ rows: [mockItem] });

      const result = await inventoryService.getByVariantId(101);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE variant_id = $1 AND is_active = TRUE'),
        [101]
      );
      expect(result).toEqual(mockItem);
    });

    it('should throw 404 AppError if variant inventory does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(inventoryService.getByVariantId(999)).rejects.toThrow(
        'Inventory record for variant ID 999 not found'
      );
    });
  });

  // =========================================================================
  // getByProductId()
  // =========================================================================
  describe('getByProductId', () => {
    it('should return all active variants for a given product ID', async () => {
      const mockItems = [
        { id: 1, product_id: 10, variant_id: 101 },
        { id: 2, product_id: 10, variant_id: 102 },
      ];
      query.mockResolvedValueOnce({ rows: mockItems });

      const result = await inventoryService.getByProductId(10);

      expect(query).toHaveBeenCalledWith(
        expect.stringContaining('WHERE product_id = $1 AND is_active = TRUE'),
        [10]
      );
      expect(result).toEqual(mockItems);
    });
  });

  // =========================================================================
  // createInventoryItem()
  // =========================================================================
  describe('createInventoryItem', () => {
    const itemData = {
      product_id: 10,
      variant_id: 101,
      sku: 'SKU-VAR-101',
      quantity_available: 50,
      low_stock_threshold: 5,
    };

    it('should throw 400 AppError if seller identity is not provided', async () => {
      await expect(
        inventoryService.createInventoryItem(itemData, null)
      ).rejects.toThrow('Seller identity is required to register an inventory item');
    });

    it('should throw 409 AppError if variant inventory record already exists', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [{ id: 1 }] }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      await expect(
        inventoryService.createInventoryItem(itemData, 'seller-100')
      ).rejects.toThrow('Inventory already exists for variant 101');
    });

    it('should successfully create inventory item, record movement, and publish event', async () => {
      const createdItem = {
        id: 1,
        seller_id: 'seller-100',
        product_id: 10,
        variant_id: 101,
        sku: 'SKU-VAR-101',
        quantity_available: 50,
        quantity_reserved: 0,
        low_stock_threshold: 5,
      };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // Variant check: none
          .mockResolvedValueOnce({ rows: [createdItem] }) // Insert inventory
          .mockResolvedValueOnce({ rows: [] }), // Insert movement
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.createInventoryItem(itemData, 'seller-100');

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(inventoryPublisher.publishStockUpdated).toHaveBeenCalledWith(createdItem);
      expect(result).toEqual(createdItem);
    });
  });

  // =========================================================================
  // adjustStock()
  // =========================================================================
  describe('adjustStock', () => {
    const existingItem = {
      id: 1,
      seller_id: 'seller-100',
      variant_id: 101,
      quantity_available: 20,
      quantity_reserved: 5,
    };

    it('should throw 404 AppError if inventory item not found', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      await expect(
        inventoryService.adjustStock(999, mockSeller, { new_quantity: 50 })
      ).rejects.toThrow('Inventory item not found');
    });

    it('should throw 403 AppError if requesting user is neither item owner nor admin', async () => {
      const otherSeller = { id: 'other-seller-999', roles: ['seller'] };
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [existingItem] }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      await expect(
        inventoryService.adjustStock(1, otherSeller, { new_quantity: 50 })
      ).rejects.toThrow('Forbidden: You can only adjust inventory for your own products.');
    });

    it('should throw 400 AppError if adjustment reduces available quantity below zero', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [existingItem] }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      await expect(
        inventoryService.adjustStock(1, mockSeller, { quantity_change: -30 })
      ).rejects.toThrow('Insufficient stock: Cannot reduce available quantity below 0');
    });

    it('should return existing item without DB update if target quantity matches current', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [existingItem] }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.adjustStock(1, mockSeller, { new_quantity: 20 });
      expect(result).toEqual(existingItem);
      expect(mockClient.query).toHaveBeenCalledTimes(1); // Only locked select
    });

    it('should successfully adjust stock with new_quantity and publish stock.updated', async () => {
      const updatedItem = { ...existingItem, quantity_available: 35 };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [existingItem] }) // Lock
          .mockResolvedValueOnce({ rows: [updatedItem] }) // Update
          .mockResolvedValueOnce({ rows: [] }), // Movement insert
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.adjustStock(1, mockSeller, {
        new_quantity: 35,
        reason: 'Restocking',
      });

      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(inventoryPublisher.publishStockUpdated).toHaveBeenCalledWith(updatedItem);
      expect(result).toEqual(updatedItem);
    });

    it('should allow admin to adjust stock for any seller item', async () => {
      const updatedItem = { ...existingItem, quantity_available: 10 };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [existingItem] })
          .mockResolvedValueOnce({ rows: [updatedItem] })
          .mockResolvedValueOnce({ rows: [] }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.adjustStock(1, mockAdmin, {
        quantity_change: -10,
        movement_type: 'ADJUSTMENT',
      });

      expect(result).toEqual(updatedItem);
    });
  });

  // =========================================================================
  // isOrderReserved()
  // =========================================================================
  describe('isOrderReserved', () => {
    it('should return false if orderId is missing', async () => {
      const result = await inventoryService.isOrderReserved(null);
      expect(result).toBe(false);
    });

    it('should return true if active reservation exists for order', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
      const result = await inventoryService.isOrderReserved('ORD-123');
      expect(result).toBe(true);
    });

    it('should return false if no reservations exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });
      const result = await inventoryService.isOrderReserved('ORD-456');
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // reserveStock()
  // =========================================================================
  describe('reserveStock', () => {
    const itemsToReserve = [
      { variant_id: 101, quantity: 2 },
      { variant_id: 102, quantity: 1 },
    ];

    it('should return existing reservations idempotently if order was already reserved', async () => {
      const existingReservations = [
        { id: 1, order_id: 'ORD-100', status: 'RESERVED' },
      ];

      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: existingReservations }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.reserveStock('ORD-100', itemsToReserve);

      expect(result.status).toBe('RESERVED');
      expect(result.items).toEqual(existingReservations);
      expect(inventoryPublisher.publishReservationSuccess).not.toHaveBeenCalled();
    });

    it('should throw 400 AppError and publish failure if available stock is insufficient', async () => {
      const lockedRows = [
        { id: 1, variant_id: 101, quantity_available: 1, quantity_reserved: 0 },
        { id: 2, variant_id: 102, quantity_available: 5, quantity_reserved: 0 },
      ];

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // Idempotency: none
          .mockResolvedValueOnce({ rows: lockedRows }), // Locked items
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      await expect(
        inventoryService.reserveStock('ORD-100', itemsToReserve)
      ).rejects.toThrow('Insufficient stock for variant 101');

      expect(inventoryPublisher.publishReservationFailed).toHaveBeenCalledWith(
        'ORD-100',
        expect.stringContaining('Insufficient stock'),
        itemsToReserve[0]
      );
    });

    it('should atomically reserve stock, update inventory, record movements, and publish events', async () => {
      const lockedRows = [
        { id: 1, variant_id: 101, quantity_available: 10, quantity_reserved: 2 },
        { id: 2, variant_id: 102, quantity_available: 5, quantity_reserved: 0 },
      ];

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // Idempotency: none
          .mockResolvedValueOnce({ rows: lockedRows }) // Locked items
          .mockResolvedValueOnce({ rows: [{ ...lockedRows[0], quantity_available: 8, quantity_reserved: 4 }] }) // Update item 1
          .mockResolvedValueOnce({ rows: [{ id: 10, order_id: 'ORD-100', variant_id: 101, quantity: 2 }] }) // Insert reservation 1
          .mockResolvedValueOnce({ rows: [] }) // Movement 1
          .mockResolvedValueOnce({ rows: [{ ...lockedRows[1], quantity_available: 4, quantity_reserved: 1 }] }) // Update item 2
          .mockResolvedValueOnce({ rows: [{ id: 11, order_id: 'ORD-100', variant_id: 102, quantity: 1 }] }) // Insert reservation 2
          .mockResolvedValueOnce({ rows: [] }), // Movement 2
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.reserveStock('ORD-100', itemsToReserve, 15, 'idem-key-1');

      expect(result.status).toBe('RESERVED');
      expect(result.items).toHaveLength(2);
      expect(inventoryPublisher.publishReservationSuccess).toHaveBeenCalledWith(
        'ORD-100',
        itemsToReserve
      );
      expect(inventoryPublisher.publishStockUpdated).toHaveBeenCalledTimes(2);
    });
  });

  // =========================================================================
  // confirmReservation()
  // =========================================================================
  describe('confirmReservation', () => {
    it('should confirm reservation, decrement reserved quantity, record SALE movement, and publish event', async () => {
      const activeReservations = [
        { id: 1, order_id: 'ORD-100', variant_id: 101, quantity: 2 },
      ];
      const invRow = { id: 1, variant_id: 101, quantity_available: 8, quantity_reserved: 2 };
      const updatedInv = { ...invRow, quantity_reserved: 0 };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: activeReservations }) // Lock reservations
          .mockResolvedValueOnce({ rows: [invRow] }) // Lock inventory
          .mockResolvedValueOnce({ rows: [updatedInv] }) // Update inventory
          .mockResolvedValueOnce({ rows: [] }) // Insert movement
          .mockResolvedValueOnce({ rows: [] }), // Update reservation to CONFIRMED
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.confirmReservation('ORD-100');

      expect(result).toEqual({ order_id: 'ORD-100', status: 'CONFIRMED' });
      expect(inventoryPublisher.publishReservationConfirmed).toHaveBeenCalledWith('ORD-100');
      expect(inventoryPublisher.publishStockUpdated).toHaveBeenCalledWith(updatedInv);
    });

    it('should return CONFIRMED idempotently if reservation was already confirmed', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // No RESERVED
          .mockResolvedValueOnce({ rows: [{ id: 1, status: 'CONFIRMED' }] }), // Already CONFIRMED
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.confirmReservation('ORD-100');
      expect(result).toEqual({ order_id: 'ORD-100', status: 'CONFIRMED' });
    });

    it('should return NOOP if no reservations found', async () => {
      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] })
          .mockResolvedValueOnce({ rows: [] }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.confirmReservation('ORD-NONE');
      expect(result).toEqual({ order_id: 'ORD-NONE', status: 'NOOP' });
    });
  });

  // =========================================================================
  // releaseReservation()
  // =========================================================================
  describe('releaseReservation', () => {
    it('should restore available stock and release hold for RESERVED reservations', async () => {
      const activeReservations = [
        { id: 1, order_id: 'ORD-100', variant_id: 101, quantity: 2, status: 'RESERVED' },
      ];
      const invRow = { id: 1, variant_id: 101, quantity_available: 8, quantity_reserved: 2 };
      const updatedInv = { ...invRow, quantity_available: 10, quantity_reserved: 0 };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: activeReservations }) // Lock reservations
          .mockResolvedValueOnce({ rows: [invRow] }) // Lock inventory
          .mockResolvedValueOnce({ rows: [updatedInv] }) // Update inventory
          .mockResolvedValueOnce({ rows: [] }) // Insert movement
          .mockResolvedValueOnce({ rows: [] }), // Update reservation to RELEASED
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.releaseReservation('ORD-100', 'Customer cancelled');

      expect(result).toEqual({ order_id: 'ORD-100', status: 'RELEASED' });
      expect(inventoryPublisher.publishReservationReleased).toHaveBeenCalledWith(
        'ORD-100',
        'Customer cancelled'
      );
      expect(inventoryPublisher.publishStockUpdated).toHaveBeenCalledWith(updatedInv);
    });

    it('should restore stock using fallback items array when no reservations found in DB', async () => {
      const fallbackItems = [{ variant_id: 101, quantity: 3 }];
      const invRow = { id: 1, variant_id: 101, quantity_available: 5, quantity_reserved: 0 };
      const updatedInv = { ...invRow, quantity_available: 8 };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [] }) // No reservations in DB
          .mockResolvedValueOnce({ rows: [invRow] }) // Lock inventory
          .mockResolvedValueOnce({ rows: [updatedInv] }) // Update inventory
          .mockResolvedValueOnce({ rows: [] }), // Movement
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.releaseReservation('ORD-FALLBACK', 'Timeout', fallbackItems);

      expect(result).toEqual({ order_id: 'ORD-FALLBACK', status: 'RELEASED' });
      expect(inventoryPublisher.publishStockUpdated).toHaveBeenCalledWith(updatedInv);
    });

    it('should return NOOP when no reservations and no fallback items', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rows: [] }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.releaseReservation('ORD-NONE', 'Nothing');
      expect(result).toEqual({ order_id: 'ORD-NONE', status: 'NOOP' });
    });
  });

  // =========================================================================
  // listMovements()
  // =========================================================================
  describe('listMovements', () => {
    it('should return paginated movement audit trail for a variant', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              variant_id: 101,
              movement_type: 'INITIAL_STOCK',
              quantity: 50,
            },
          ],
        });

      const result = await inventoryService.listMovements(101, 1, 10);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('SELECT COUNT(*)::int AS total FROM inventory_movements WHERE variant_id = $1'),
        [101]
      );
      expect(result.movements).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
    });
  });

  // =========================================================================
  // deleteByProductId()
  // =========================================================================
  describe('deleteByProductId', () => {
    it('should scope deletion to seller ID for non-admin sellers', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rowCount: 2 }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.deleteByProductId(10, mockSeller);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM inventory WHERE product_id = $1 AND seller_id = $2',
        [10, 'seller-100']
      );
      expect(result).toEqual({ success: true, count: 2 });
    });

    it('should allow admin to delete all inventory items for a product without seller restriction', async () => {
      const mockClient = {
        query: jest.fn().mockResolvedValueOnce({ rowCount: 3 }),
      };
      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await inventoryService.deleteByProductId(10, mockAdmin);

      expect(mockClient.query).toHaveBeenCalledWith(
        'DELETE FROM inventory WHERE product_id = $1',
        [10]
      );
      expect(result).toEqual({ success: true, count: 3 });
    });
  });
});
