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

jest.unstable_mockModule('../../services/product.client.js', () => ({
  default: {
    validateOrderItem: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/inventory.client.js', () => ({
  default: {
    reserveStock: jest.fn(),
    confirmReservation: jest.fn(),
    releaseReservation: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/idempotency.service.js', () => ({
  default: {
    findOrderByKey: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/outbox.service.js', () => ({
  default: {
    recordEvent: jest.fn(),
  },
}));

jest.unstable_mockModule('../../events/publishers/order.publisher.js', () => ({
  default: {
    publishOrderCreated: jest.fn().mockResolvedValue(true),
    publishOrderPaid: jest.fn().mockResolvedValue(true),
    publishOrderCancelled: jest.fn().mockResolvedValue(true),
    publishOrderStatusUpdated: jest.fn().mockResolvedValue(true),
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
const { default: productClient } = await import('../../services/product.client.js');
const { default: inventoryClient } = await import('../../services/inventory.client.js');
const { default: idempotencyService } = await import('../../services/idempotency.service.js');
const { default: outboxService } = await import('../../services/outbox.service.js');
const { default: orderPublisher } = await import('../../events/publishers/order.publisher.js');
const { default: orderService } = await import('../../services/order.service.js');

describe('Order Service Unit Tests', () => {
  const mockUser = {
    id: 'usr-customer-1',
    email: 'customer@example.com',
    displayName: 'Customer One',
    roles: ['customer'],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  describe('createOrder', () => {
    const orderData = {
      items: [{ product_id: 1, variant_id: 10, quantity: 2 }],
      shipping_address: { street: '123 Test St', city: 'City', country: 'US', phone: '1234567890' },
      idempotency_key: 'test-idem-key',
    };

    it('should return existing order if idempotency key was previously processed', async () => {
      const existing = { id: 99, order_number: 'ORD-EXISTING-99' };
      idempotencyService.findOrderByKey.mockResolvedValueOnce(existing);

      const result = await orderService.createOrder(mockUser, orderData);

      expect(idempotencyService.findOrderByKey).toHaveBeenCalledWith('test-idem-key');
      expect(productClient.validateOrderItem).not.toHaveBeenCalled();
      expect(result).toBe(existing);
    });

    it('should calculate financials, reserve stock, and commit order in transaction', async () => {
      idempotencyService.findOrderByKey.mockResolvedValueOnce(null);

      // Product validation snapshot
      productClient.validateOrderItem.mockResolvedValueOnce({
        product_id: 1,
        variant_id: 10,
        product_name: 'Super Gadget',
        variant_name: 'Silver',
        sku: 'GAD-SLV',
        unit_price: 30.0, // 2 items = $60.00 -> Free shipping (>= $50)
        currency: 'USD',
        seller_id: 'seller-abc',
      });

      inventoryClient.reserveStock.mockResolvedValueOnce({ id: 'res-1' });

      // DB Transaction
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn(),
        };
        // 1. Order insert
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              id: 100,
              order_number: 'ORD-20261102-MOCK12',
              user_id: 'usr-customer-1',
              total_amount: '64.80', // 60 + 0 shipping + 4.80 tax (8%)
              subtotal: '60.00',
              customer_email: 'customer@example.com',
            },
          ],
        });
        // 2. Order items insert
        mockClient.query.mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              order_id: 100,
              product_id: 1,
              variant_id: 10,
              quantity: 2,
              unit_price: '30.00',
              line_total: '60.00',
            },
          ],
        });
        // 3. Status history insert
        mockClient.query.mockResolvedValueOnce({ rows: [] });
        return callback(mockClient);
      });

      const order = await orderService.createOrder(mockUser, orderData);

      expect(productClient.validateOrderItem).toHaveBeenCalledWith(1, 10);
      expect(inventoryClient.reserveStock).toHaveBeenCalledWith(
        expect.stringMatching(/^ORD-\d{8}-[A-Z0-9]{6}$/),
        [{ variant_id: 10, quantity: 2 }],
        15,
        mockUser
      );
      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        'Order',
        100,
        'order.created',
        expect.objectContaining({ order_id: '100' })
      );
      expect(orderPublisher.publishOrderCreated).toHaveBeenCalled();
      expect(order.id).toBe(100);
      expect(order.items).toHaveLength(1);
    });

    it('should apply $5.00 shipping fee when subtotal is under $50', async () => {
      idempotencyService.findOrderByKey.mockResolvedValueOnce(null);

      productClient.validateOrderItem.mockResolvedValueOnce({
        product_id: 2,
        variant_id: 20,
        product_name: 'Cheaper Item',
        unit_price: 20.0, // 1 item = $20.00 (< $50) -> $5 shipping
        currency: 'USD',
      });

      inventoryClient.reserveStock.mockResolvedValueOnce({ id: 'res-2' });

      let capturedShippingFee, capturedTotal;
      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn((sql, params) => {
            if (sql.includes('INSERT INTO orders')) {
              capturedShippingFee = params[4]; // shippingFee is 5th param ($5)
              capturedTotal = params[7]; // totalAmount is 8th param ($8)
              return {
                rows: [{ id: 101, order_number: params[0], total_amount: capturedTotal }],
              };
            }
            return { rows: [{ id: 1 }] };
          }),
        };
        return callback(mockClient);
      });

      await orderService.createOrder(mockUser, {
        items: [{ product_id: 2, variant_id: 20, quantity: 1 }],
        shipping_address: orderData.shipping_address,
      });

      expect(capturedShippingFee).toBe(5.0);
      // 20 + 5 (shipping) + 1.60 (tax: 20 * 0.08) = 26.60
      expect(capturedTotal).toBe(26.6);
    });
  });

  describe('getOrderById', () => {
    it('should throw AppError 404 when order is not found', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(orderService.getOrderById(999, mockUser)).rejects.toMatchObject({
        statusCode: 404,
        message: 'Order not found',
      });
    });

    it('should throw AppError 403 when user is not owner, not admin, and not item seller', async () => {
      const mockOrder = {
        id: 10,
        user_id: 'other-user',
        items: [{ seller_id: 'other-seller' }],
      };
      query.mockResolvedValueOnce({ rows: [mockOrder] });

      await expect(orderService.getOrderById(10, mockUser)).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Forbidden: You can only view orders'),
      });
    });

    it('should allow customer who owns the order', async () => {
      const mockOrder = {
        id: 10,
        user_id: 'usr-customer-1',
        items: [],
      };
      query.mockResolvedValueOnce({ rows: [mockOrder] });

      const result = await orderService.getOrderById(10, mockUser);
      expect(result).toBe(mockOrder);
    });

    it('should allow administrator to view any order', async () => {
      const adminUser = { id: 'admin-99', roles: ['admin'] };
      const mockOrder = {
        id: 10,
        user_id: 'other-user',
        items: [],
      };
      query.mockResolvedValueOnce({ rows: [mockOrder] });

      const result = await orderService.getOrderById(10, adminUser);
      expect(result).toBe(mockOrder);
    });

    it('should allow seller whose item is in the order', async () => {
      const sellerUser = { id: 'seller-50', roles: ['seller'] };
      const mockOrder = {
        id: 10,
        user_id: 'buyer-1',
        items: [{ id: 1, seller_id: 'seller-50' }],
      };
      query.mockResolvedValueOnce({ rows: [mockOrder] });

      const result = await orderService.getOrderById(10, sellerUser);
      expect(result).toBe(mockOrder);
    });
  });

  describe('getOrderByNumber', () => {
    it('should throw AppError 404 if order_number does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(
        orderService.getOrderByNumber('ORD-NON-EXISTENT', mockUser)
      ).rejects.toMatchObject({
        statusCode: 404,
        message: "Order 'ORD-NON-EXISTENT' not found",
      });
    });

    it('should delegate to getOrderById when order_number is found', async () => {
      query.mockResolvedValueOnce({ rows: [{ id: 55 }] });
      const mockOrder = { id: 55, order_number: 'ORD-FOUND' };
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce(mockOrder);

      const result = await orderService.getOrderByNumber('ORD-FOUND', mockUser);

      expect(orderService.getOrderById).toHaveBeenCalledWith(55, mockUser);
      expect(result).toBe(mockOrder);
    });
  });

  describe('listOrders', () => {
    it('should restrict queries to user_id for regular customers', async () => {
      query.mockResolvedValueOnce({ rows: [{ total: 1 }] }); // count
      query.mockResolvedValueOnce({ rows: [{ id: 10, order_number: 'ORD-1' }] }); // data

      const result = await orderService.listOrders({ page: 1, limit: 10 }, mockUser);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('o.user_id = $1'),
        [mockUser.id]
      );
      expect(result.pagination.total).toBe(1);
      expect(result.orders).toHaveLength(1);
    });

    it('should filter by seller_id subquery when seller requests seller view', async () => {
      const sellerUser = { id: 'seller-1', roles: ['seller'] };
      query.mockResolvedValueOnce({ rows: [{ total: 5 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 20 }] });

      const result = await orderService.listOrders({ as_seller: 'true' }, sellerUser);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('s_oi.seller_id = $1'),
        ['seller-1']
      );
      expect(result.pagination.total).toBe(5);
    });

    it('should allow admin to filter by arbitrary user_id, status, and search string', async () => {
      const adminUser = { id: 'admin-1', roles: ['admin'] };
      query.mockResolvedValueOnce({ rows: [{ total: 2 }] });
      query.mockResolvedValueOnce({ rows: [{ id: 30 }] });

      await orderService.listOrders(
        {
          user_id: 'target-user',
          status: 'CONFIRMED',
          payment_status: 'PAID',
          search: 'john',
        },
        adminUser
      );

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('o.user_id = $1 AND o.status = $2 AND o.payment_status = $3'),
        ['target-user', 'CONFIRMED', 'PAID', '%john%']
      );
    });
  });

  describe('payOrder', () => {
    it('should throw AppError 400 when order status is CANCELLED or FAILED', async () => {
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce({
        id: 10,
        status: 'CANCELLED',
      });

      await expect(
        orderService.payOrder(10, mockUser)
      ).rejects.toMatchObject({
        statusCode: 400,
        message: 'Cannot process payment for an order with status CANCELLED',
      });
    });

    it('should return order idempotently if already paid', async () => {
      const paidOrder = { id: 10, status: 'CONFIRMED', payment_status: 'PAID' };
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce(paidOrder);

      const result = await orderService.payOrder(10, mockUser);

      expect(result).toBe(paidOrder);
      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('should update status to CONFIRMED, record outbox event, and confirm inventory', async () => {
      const pendingOrder = {
        id: 15,
        order_number: 'ORD-15',
        status: 'PENDING',
        payment_status: 'PENDING',
        user_id: mockUser.id,
        items: [{ variant_id: 1, quantity: 2 }],
      };
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce(pendingOrder);

      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({
            rows: [{ id: 15, status: 'CONFIRMED', payment_status: 'PAID' }],
          }),
        };
        return callback(mockClient);
      });

      const updated = await orderService.payOrder(15, mockUser, { payment_method: 'STRIPE' });

      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        'Order',
        15,
        'order.paid',
        expect.objectContaining({ payment_status: 'PAID' })
      );
      expect(inventoryClient.confirmReservation).toHaveBeenCalledWith('ORD-15', null, '15');
      expect(orderPublisher.publishOrderPaid).toHaveBeenCalled();
      expect(updated.status).toBe('CONFIRMED');
    });
  });

  describe('cancelOrder', () => {
    it('should throw AppError 400 if order is already SHIPPED or DELIVERED', async () => {
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce({
        id: 20,
        status: 'SHIPPED',
      });

      await expect(orderService.cancelOrder(20, mockUser)).rejects.toMatchObject({
        statusCode: 400,
        message: expect.stringContaining('Cannot cancel an order that is already SHIPPED'),
      });
    });

    it('should return order idempotently if already CANCELLED', async () => {
      const cancelledOrder = { id: 20, status: 'CANCELLED' };
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce(cancelledOrder);

      const result = await orderService.cancelOrder(20, mockUser);

      expect(result).toBe(cancelledOrder);
      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('should cancel order, release inventory reservation, and publish event', async () => {
      const order = {
        id: 25,
        order_number: 'ORD-25',
        status: 'PENDING',
        user_id: mockUser.id,
        items: [{ variant_id: 10, quantity: 1 }],
      };
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce(order);

      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({
            rows: [{ id: 25, status: 'CANCELLED' }],
          }),
        };
        return callback(mockClient);
      });

      const cancelled = await orderService.cancelOrder(25, mockUser, 'Buyer changed mind');

      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        'Order',
        25,
        'order.cancelled',
        expect.objectContaining({ reason: 'Buyer changed mind' })
      );
      expect(inventoryClient.releaseReservation).toHaveBeenCalledWith(
        'ORD-25',
        'Buyer changed mind',
        [{ variant_id: 10, quantity: 1 }],
        '25'
      );
      expect(orderPublisher.publishOrderCancelled).toHaveBeenCalledWith(
        cancelled,
        'Buyer changed mind'
      );
      expect(cancelled.status).toBe('CANCELLED');
    });
  });

  describe('updateOrderStatus', () => {
    it('should throw AppError 403 if user is not admin and not seller', async () => {
      await expect(
        orderService.updateOrderStatus(10, mockUser, { status: 'SHIPPED' })
      ).rejects.toMatchObject({
        statusCode: 403,
        message: expect.stringContaining('Forbidden: Only store administrators or sellers'),
      });
    });

    it('should return unchanged order if new status is identical to current status', async () => {
      const adminUser = { id: 'admin-1', roles: ['admin'] };
      const order = { id: 30, status: 'PROCESSING', items: [] };
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce(order);

      const result = await orderService.updateOrderStatus(30, adminUser, {
        status: 'PROCESSING',
      });

      expect(result).toBe(order);
      expect(withTransaction).not.toHaveBeenCalled();
    });

    it('should update status, record history, and publish event for admin/seller', async () => {
      const adminUser = { id: 'admin-1', roles: ['admin'] };
      const order = { id: 35, order_number: 'ORD-35', status: 'CONFIRMED', items: [] };
      jest.spyOn(orderService, 'getOrderById').mockResolvedValueOnce(order);

      withTransaction.mockImplementationOnce(async (callback) => {
        const mockClient = {
          query: jest.fn().mockResolvedValue({
            rows: [{ id: 35, status: 'PROCESSING' }],
          }),
        };
        return callback(mockClient);
      });

      const updated = await orderService.updateOrderStatus(35, adminUser, {
        status: 'PROCESSING',
        reason: 'Preparing package',
      });

      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        expect.anything(),
        'Order',
        35,
        'order.status_updated',
        expect.objectContaining({ new_status: 'PROCESSING' })
      );
      expect(orderPublisher.publishOrderStatusUpdated).toHaveBeenCalledWith(
        updated,
        'CONFIRMED',
        'PROCESSING',
        'Preparing package'
      );
      expect(updated.status).toBe('PROCESSING');
    });
  });
});
