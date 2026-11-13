import { jest } from '@jest/globals';

jest.unstable_mockModule('../../services/inventory.service.js', () => ({
  default: {
    listInventory: jest.fn(),
    getByVariantId: jest.fn(),
    getByProductId: jest.fn(),
    createInventoryItem: jest.fn(),
    adjustStock: jest.fn(),
    reserveStock: jest.fn(),
    confirmReservation: jest.fn(),
    releaseReservation: jest.fn(),
    listMovements: jest.fn(),
    deleteByProductId: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/idempotency.service.js', () => ({
  default: {
    getRecord: jest.fn(),
    saveRecord: jest.fn(),
    hashPayload: jest.fn(),
  },
}));

const { default: inventoryService } = await import('../../services/inventory.service.js');
const { default: idempotencyService } = await import('../../services/idempotency.service.js');
const {
  listInventory,
  getByVariantId,
  getByProductId,
  createInventoryItem,
  adjustStock,
  reserveStock,
  confirmReservation,
  releaseReservation,
  listMovements,
  deleteByProductId,
} = await import('../../controllers/inventory.controller.js');

describe('Inventory Controller Unit Tests', () => {
  let req, res, next;

  beforeEach(() => {
    jest.clearAllMocks();
    req = {
      query: {},
      params: {},
      body: {},
      user: { id: 'seller-123', roles: ['seller'] },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('listInventory', () => {
    it('should return 200 with inventory items on success', async () => {
      const mockResult = {
        items: [{ id: 1, sku: 'SKU-01', quantity_available: 50 }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      inventoryService.listInventory.mockResolvedValueOnce(mockResult);

      req.query = { page: '1', limit: '20' };
      await listInventory(req, res, next);

      expect(inventoryService.listInventory).toHaveBeenCalledWith(req.query, req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when service throws', async () => {
      const error = new Error('Database error');
      inventoryService.listInventory.mockRejectedValueOnce(error);

      await listInventory(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  describe('getByVariantId', () => {
    it('should return 200 with variant inventory item', async () => {
      const mockItem = { id: 1, variant_id: 10, sku: 'SKU-10', quantity_available: 25 };
      inventoryService.getByVariantId.mockResolvedValueOnce(mockItem);

      req.params = { variantId: '10' };
      await getByVariantId(req, res, next);

      expect(inventoryService.getByVariantId).toHaveBeenCalledWith('10');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { item: mockItem },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when getByVariantId fails', async () => {
      const error = new Error('Variant not found');
      inventoryService.getByVariantId.mockRejectedValueOnce(error);

      req.params = { variantId: '999' };
      await getByVariantId(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getByProductId', () => {
    it('should return 200 with list of variant items for a product', async () => {
      const mockItems = [
        { id: 1, product_id: 5, variant_id: 10 },
        { id: 2, product_id: 5, variant_id: 11 },
      ];
      inventoryService.getByProductId.mockResolvedValueOnce(mockItems);

      req.params = { productId: '5' };
      await getByProductId(req, res, next);

      expect(inventoryService.getByProductId).toHaveBeenCalledWith('5');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { items: mockItems },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when getByProductId fails', async () => {
      const error = new Error('Database connection failed');
      inventoryService.getByProductId.mockRejectedValueOnce(error);

      req.params = { productId: '5' };
      await getByProductId(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('createInventoryItem', () => {
    it('should return 201 with newly created inventory item', async () => {
      const newItem = { id: 1, product_id: 5, variant_id: 10, quantity_available: 100 };
      inventoryService.createInventoryItem.mockResolvedValueOnce(newItem);

      req.body = { product_id: 5, variant_id: 10, sku: 'SKU-10', quantity_available: 100 };
      await createInventoryItem(req, res, next);

      expect(inventoryService.createInventoryItem).toHaveBeenCalledWith(req.body, 'seller-123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Inventory record created successfully',
        data: { item: newItem },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when createInventoryItem fails', async () => {
      const error = new Error('Duplicate variant');
      inventoryService.createInventoryItem.mockRejectedValueOnce(error);

      req.body = { product_id: 5, variant_id: 10 };
      await createInventoryItem(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('adjustStock', () => {
    it('should return 200 with updated inventory item', async () => {
      const updatedItem = { id: 1, quantity_available: 80 };
      inventoryService.adjustStock.mockResolvedValueOnce(updatedItem);

      req.params = { id: '1' };
      req.body = { adjustment: -20, reason: 'CORRECTION' };
      await adjustStock(req, res, next);

      expect(inventoryService.adjustStock).toHaveBeenCalledWith('1', req.user, req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Stock adjusted successfully',
        data: { item: updatedItem },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when adjustStock fails', async () => {
      const error = new Error('Insufficient stock');
      inventoryService.adjustStock.mockRejectedValueOnce(error);

      req.params = { id: '1' };
      req.body = { adjustment: -1000 };
      await adjustStock(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('reserveStock', () => {
    const reservationData = {
      order_id: 'ord-500',
      items: [{ variant_id: 1, quantity: 2 }],
      expires_in_minutes: 15,
      idempotency_key: 'idem-key-abc',
    };

    it('should return cached response if idempotency key exists in cache', async () => {
      const cachedRecord = {
        response_status: 200,
        response_body: {
          success: true,
          message: 'Stock reserved successfully',
          data: { reservation: { id: 'res-cached' } },
        },
      };
      idempotencyService.getRecord.mockResolvedValueOnce(cachedRecord);

      req.body = { ...reservationData };
      await reserveStock(req, res, next);

      expect(idempotencyService.getRecord).toHaveBeenCalledWith('idem-key-abc');
      expect(inventoryService.reserveStock).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(cachedRecord.response_body);
      expect(next).not.toHaveBeenCalled();
    });

    it('should reserve stock, cache response, and return 200 when idempotency key is new', async () => {
      idempotencyService.getRecord.mockResolvedValueOnce(null);
      idempotencyService.hashPayload.mockReturnValueOnce('hash-12345');
      const mockReservation = { id: 1, order_id: 'ord-500', status: 'RESERVED' };
      inventoryService.reserveStock.mockResolvedValueOnce(mockReservation);

      req.body = { ...reservationData };
      await reserveStock(req, res, next);

      expect(idempotencyService.getRecord).toHaveBeenCalledWith('idem-key-abc');
      expect(inventoryService.reserveStock).toHaveBeenCalledWith(
        'ord-500',
        reservationData.items,
        15,
        'idem-key-abc'
      );
      expect(idempotencyService.hashPayload).toHaveBeenCalledWith(req.body);
      expect(idempotencyService.saveRecord).toHaveBeenCalledWith(
        'idem-key-abc',
        'hash-12345',
        200,
        {
          success: true,
          message: 'Stock reserved successfully',
          data: { reservation: mockReservation },
        }
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Stock reserved successfully',
        data: { reservation: mockReservation },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should reserve stock without caching if no idempotency key provided', async () => {
      const { idempotency_key, ...bodyWithoutIdempotency } = reservationData;
      req.body = bodyWithoutIdempotency;

      const mockReservation = { id: 2, order_id: 'ord-500', status: 'RESERVED' };
      inventoryService.reserveStock.mockResolvedValueOnce(mockReservation);

      await reserveStock(req, res, next);

      expect(idempotencyService.getRecord).not.toHaveBeenCalled();
      expect(inventoryService.reserveStock).toHaveBeenCalledWith(
        'ord-500',
        bodyWithoutIdempotency.items,
        15,
        undefined
      );
      expect(idempotencyService.saveRecord).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Stock reserved successfully',
        data: { reservation: mockReservation },
      });
    });

    it('should call next with error when reserveStock fails', async () => {
      const error = new Error('Insufficient stock for reservation');
      inventoryService.reserveStock.mockRejectedValueOnce(error);

      req.body = { ...reservationData };
      await reserveStock(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('confirmReservation', () => {
    it('should return 200 when reservation is confirmed', async () => {
      const mockResult = { confirmed: 2 };
      inventoryService.confirmReservation.mockResolvedValueOnce(mockResult);

      req.body = { order_id: 'ord-600', order_number: 'ORD-600' };
      await confirmReservation(req, res, next);

      expect(inventoryService.confirmReservation).toHaveBeenCalledWith('ord-600', 'ORD-600');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reservation confirmed to permanent sale',
        data: mockResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when confirmReservation fails', async () => {
      const error = new Error('Confirmation failed');
      inventoryService.confirmReservation.mockRejectedValueOnce(error);

      req.body = { order_id: 'ord-600' };
      await confirmReservation(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('releaseReservation', () => {
    it('should return 200 when reservation is released', async () => {
      const mockResult = { released: 2 };
      inventoryService.releaseReservation.mockResolvedValueOnce(mockResult);

      req.body = {
        order_id: 'ord-700',
        order_number: 'ORD-700',
        reason: 'Customer cancelled',
        items: [{ variant_id: 1, quantity: 2 }],
      };
      await releaseReservation(req, res, next);

      expect(inventoryService.releaseReservation).toHaveBeenCalledWith(
        'ord-700',
        'Customer cancelled',
        req.body.items,
        'ORD-700'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Reservation released back to available inventory',
        data: mockResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when releaseReservation fails', async () => {
      const error = new Error('Release failed');
      inventoryService.releaseReservation.mockRejectedValueOnce(error);

      req.body = { order_id: 'ord-700' };
      await releaseReservation(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listMovements', () => {
    it('should return 200 with default pagination when query is empty', async () => {
      const mockResult = {
        movements: [{ id: 1, movement_type: 'IN' }],
        pagination: { page: 1, limit: 20, total: 1 },
      };
      inventoryService.listMovements.mockResolvedValueOnce(mockResult);

      req.params = { variantId: '10' };
      req.query = {};
      await listMovements(req, res, next);

      expect(inventoryService.listMovements).toHaveBeenCalledWith('10', 1, 20);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should parse custom page and limit query parameters', async () => {
      const mockResult = {
        movements: [{ id: 2, movement_type: 'OUT' }],
        pagination: { page: 3, limit: 10, total: 25 },
      };
      inventoryService.listMovements.mockResolvedValueOnce(mockResult);

      req.params = { variantId: '10' };
      req.query = { page: '3', limit: '10' };
      await listMovements(req, res, next);

      expect(inventoryService.listMovements).toHaveBeenCalledWith('10', 3, 10);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should call next with error when listMovements fails', async () => {
      const error = new Error('Movement fetch failed');
      inventoryService.listMovements.mockRejectedValueOnce(error);

      req.params = { variantId: '10' };
      await listMovements(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('deleteByProductId', () => {
    it('should return 200 with deleted records result', async () => {
      const mockResult = { deletedCount: 3 };
      inventoryService.deleteByProductId.mockResolvedValueOnce(mockResult);

      req.params = { productId: '42' };
      await deleteByProductId(req, res, next);

      expect(inventoryService.deleteByProductId).toHaveBeenCalledWith('42', req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Inventory records for product deleted successfully',
        data: mockResult,
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next with error when deleteByProductId fails', async () => {
      const error = new Error('Unauthorized deletion');
      inventoryService.deleteByProductId.mockRejectedValueOnce(error);

      req.params = { productId: '42' };
      await deleteByProductId(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });
});
