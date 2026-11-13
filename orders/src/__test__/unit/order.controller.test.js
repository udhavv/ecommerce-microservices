import { jest } from '@jest/globals';

jest.unstable_mockModule('../../services/order.service.js', () => ({
  default: {
    createOrder: jest.fn(),
    getOrderById: jest.fn(),
    getOrderByNumber: jest.fn(),
    listOrders: jest.fn(),
    payOrder: jest.fn(),
    cancelOrder: jest.fn(),
    updateOrderStatus: jest.fn(),
  },
}));

const { default: orderService } = await import('../../services/order.service.js');
const orderController = await import('../../controllers/order.controller.js');
const {
  createOrder,
  getOrderById,
  getOrderByNumber,
  listOrders,
  payOrder,
  cancelOrder,
  updateOrderStatus,
} = orderController;

describe('Order Controller Unit Tests', () => {
  let req, res, next;
  let consoleLogSpy;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    req = {
      user: { id: 'usr-100', email: 'user@example.com', roles: ['customer'] },
      body: {},
      params: {},
      query: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  describe('createOrder', () => {
    it('should return 201 with newly created order', async () => {
      const mockOrder = { id: 1, order_number: 'ORD-001', total_amount: 100 };
      orderService.createOrder.mockResolvedValueOnce(mockOrder);

      req.body = { items: [{ product_id: 1, variant_id: 2, quantity: 1 }] };
      await createOrder(req, res, next);

      expect(orderService.createOrder).toHaveBeenCalledWith(req.user, req.body);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order created and stock reserved successfully',
        data: { order: mockOrder },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('should pass error to next when createOrder throws', async () => {
      const error = new Error('Stock unavailable');
      orderService.createOrder.mockRejectedValueOnce(error);

      await createOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getOrderById', () => {
    it('should return 200 with order by id', async () => {
      const mockOrder = { id: 1, order_number: 'ORD-001' };
      orderService.getOrderById.mockResolvedValueOnce(mockOrder);

      req.params = { id: '1' };
      await getOrderById(req, res, next);

      expect(orderService.getOrderById).toHaveBeenCalledWith('1', req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { order: mockOrder },
      });
    });

    it('should pass error to next when getOrderById throws', async () => {
      const error = new Error('Order not found');
      orderService.getOrderById.mockRejectedValueOnce(error);

      req.params = { id: '999' };
      await getOrderById(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('getOrderByNumber', () => {
    it('should return 200 with order by orderNumber', async () => {
      const mockOrder = { id: 2, order_number: 'ORD-XYZ' };
      orderService.getOrderByNumber.mockResolvedValueOnce(mockOrder);

      req.params = { orderNumber: 'ORD-XYZ' };
      await getOrderByNumber(req, res, next);

      expect(orderService.getOrderByNumber).toHaveBeenCalledWith('ORD-XYZ', req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { order: mockOrder },
      });
    });

    it('should pass error to next when getOrderByNumber throws', async () => {
      const error = new Error('Order number not found');
      orderService.getOrderByNumber.mockRejectedValueOnce(error);

      req.params = { orderNumber: 'INVALID' };
      await getOrderByNumber(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('listOrders', () => {
    it('should return 200 with order listing and pagination', async () => {
      const mockResult = {
        orders: [{ id: 1 }, { id: 2 }],
        pagination: { total: 2, page: 1, limit: 20 },
      };
      orderService.listOrders.mockResolvedValueOnce(mockResult);

      req.query = { page: '1', limit: '20' };
      await listOrders(req, res, next);

      expect(orderService.listOrders).toHaveBeenCalledWith(req.query, req.user);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockResult,
      });
    });

    it('should pass error to next when listOrders throws', async () => {
      const error = new Error('Query failed');
      orderService.listOrders.mockRejectedValueOnce(error);

      await listOrders(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('payOrder', () => {
    it('should return 200 when order payment succeeds', async () => {
      const updatedOrder = { id: 1, payment_status: 'PAID', status: 'CONFIRMED' };
      orderService.payOrder.mockResolvedValueOnce(updatedOrder);

      req.params = { id: '1' };
      req.body = { payment_method: 'CREDIT_CARD' };
      await payOrder(req, res, next);

      expect(orderService.payOrder).toHaveBeenCalledWith('1', req.user, req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order payment settled and reservation confirmed',
        data: { order: updatedOrder },
      });
    });

    it('should pass error to next when payOrder throws', async () => {
      const error = new Error('Payment rejected');
      orderService.payOrder.mockRejectedValueOnce(error);

      req.params = { id: '1' };
      await payOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('cancelOrder', () => {
    it('should return 200 when order is cancelled', async () => {
      const cancelledOrder = { id: 1, status: 'CANCELLED' };
      orderService.cancelOrder.mockResolvedValueOnce(cancelledOrder);

      req.params = { id: '1' };
      req.body = { reason: 'Customer changed mind' };
      await cancelOrder(req, res, next);

      expect(orderService.cancelOrder).toHaveBeenCalledWith('1', req.user, 'Customer changed mind');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order cancelled and stock released back to inventory',
        data: { order: cancelledOrder },
      });
    });

    it('should pass error to next when cancelOrder throws', async () => {
      const error = new Error('Already shipped');
      orderService.cancelOrder.mockRejectedValueOnce(error);

      req.params = { id: '1' };
      await cancelOrder(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('updateOrderStatus', () => {
    it('should return 200 when status is updated', async () => {
      const updatedOrder = { id: 1, status: 'SHIPPED' };
      orderService.updateOrderStatus.mockResolvedValueOnce(updatedOrder);

      req.params = { id: '1' };
      req.body = { status: 'SHIPPED', reason: 'Dispatched with carrier' };
      await updateOrderStatus(req, res, next);

      expect(orderService.updateOrderStatus).toHaveBeenCalledWith('1', req.user, req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Order status updated to SHIPPED',
        data: { order: updatedOrder },
      });
    });

    it('should pass error to next when updateOrderStatus throws', async () => {
      const error = new Error('Unauthorized role');
      orderService.updateOrderStatus.mockRejectedValueOnce(error);

      req.params = { id: '1' };
      await updateOrderStatus(req, res, next);

      expect(next).toHaveBeenCalledWith(error);
    });
  });

  describe('Default export', () => {
    it('should export all handlers on default object', () => {
      expect(orderController.default.createOrder).toBe(createOrder);
      expect(orderController.default.getOrderById).toBe(getOrderById);
      expect(orderController.default.getOrderByNumber).toBe(getOrderByNumber);
      expect(orderController.default.listOrders).toBe(listOrders);
      expect(orderController.default.payOrder).toBe(payOrder);
      expect(orderController.default.cancelOrder).toBe(cancelOrder);
      expect(orderController.default.updateOrderStatus).toBe(updateOrderStatus);
    });
  });
});
