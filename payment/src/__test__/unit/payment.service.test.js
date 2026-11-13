// import { jest, describe, it, expect, beforeEach } from '@jest/globals';

// // -----------------------------------------------------------------------------
// // Mock functions
// // -----------------------------------------------------------------------------

// const mockQuery = jest.fn();
// const mockWithTransaction = jest.fn();

// const mockCharge = jest.fn();
// const mockRefund = jest.fn();

// const mockGetOrder = jest.fn();
// const mockMarkOrderAsPaid = jest.fn();

// const mockRecordEvent = jest.fn();

// const mockPublishPaymentSuccessful = jest.fn();
// const mockPublishPaymentFailed = jest.fn();
// const mockPublishPaymentRefunded = jest.fn();

// const mockLogger = {
//   info: jest.fn(),
//   warn: jest.fn(),
//   error: jest.fn(),
//   debug: jest.fn(),
// };

// // -----------------------------------------------------------------------------
// // Mock dependencies BEFORE importing the service
// // -----------------------------------------------------------------------------

// jest.unstable_mockModule('../../config/db.js', () => ({
//   query: mockQuery,
//   withTransaction: mockWithTransaction,
// }));

// jest.unstable_mockModule('../../services/mockGateway.js', () => ({
//   default: {
//     charge: mockCharge,
//     refund: mockRefund,
//   },
// }));

// jest.unstable_mockModule('../../services/order.client.js', () => ({
//   default: {
//     getOrder: mockGetOrder,
//     markOrderAsPaid: mockMarkOrderAsPaid,
//   },
// }));

// jest.unstable_mockModule('../../services/outbox.service.js', () => ({
//   default: {
//     recordEvent: mockRecordEvent,
//   },
// }));

// jest.unstable_mockModule(
//   '../../events/publishers/payment.publisher.js',
//   () => ({
//     default: {
//       publishPaymentSuccessful: mockPublishPaymentSuccessful,
//       publishPaymentFailed: mockPublishPaymentFailed,
//       publishPaymentRefunded: mockPublishPaymentRefunded,
//     },
//   })
// );

// jest.unstable_mockModule('../../utils/logger.js', () => ({
//   default: mockLogger,
// }));

// // -----------------------------------------------------------------------------
// // Import service AFTER mocks
// // -----------------------------------------------------------------------------

// const { default: paymentService } = await import(
//   '../../../src/services/payment.service.js'
// );

// const { AppError } = await import(
//   '../../../src/middleware/errorHandler.js'
// );

// // -----------------------------------------------------------------------------
// // Test fixtures
// // -----------------------------------------------------------------------------

// const user = {
//   id: 'user-123',
//   role: 'CUSTOMER',
// };

// const admin = {
//   id: 'admin-123',
//   role: 'ADMIN',
// };

// const order = {
//   id: 'order-123',
//   user_id: 'user-123',
//   total_amount: '1000.00',
//   currency: 'USD',
//   status: 'PENDING',
// };

// const payment = {
//   id: 'payment-123',
//   order_id: 'order-123',
//   user_id: 'user-123',
//   amount: '1000.00',
//   currency: 'USD',
//   status: 'CAPTURED',
//   payment_method: 'CARD',
//   gateway_transaction_id: 'gateway-tx-123',
//   created_at: new Date(),
// };

// const capturedPayment = {
//   ...payment,
//   status: 'CAPTURED',
// };

// const gatewayChargeResult = {
//   success: true,
//   transactionId: 'gateway-tx-123',
//   status: 'CAPTURED',
// };

// const gatewayRefundResult = {
//   success: true,
//   refundId: 'gateway-refund-123',
//   status: 'REFUNDED',
// };

// const transactionClient = {
//   query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }),
// };

// // -----------------------------------------------------------------------------
// // Helpers
// // -----------------------------------------------------------------------------

// const resetTransactionClient = () => {
//   transactionClient.query.mockReset();
//   transactionClient.query.mockResolvedValue({
//     rows: [],
//     rowCount: 1,
//   });
// };

// const setupSuccessfulTransaction = (result = {}) => {
//   mockWithTransaction.mockImplementation(async (callback) => {
//     const transactionResult = await callback(transactionClient);

//     return {
//       ...transactionResult,
//       ...result,
//     };
//   });
// };

// const setupPaymentLookup = (paymentData = payment) => {
//   mockQuery.mockResolvedValue({
//     rows: [paymentData],
//     rowCount: 1,
//   });
// };

// // -----------------------------------------------------------------------------
// // Setup
// // -----------------------------------------------------------------------------

// beforeEach(() => {
//   jest.clearAllMocks();

//   resetTransactionClient();

//   mockQuery.mockResolvedValue({
//     rows: [],
//     rowCount: 0,
//   });

//   mockWithTransaction.mockImplementation(async (callback) => {
//     return callback(transactionClient);
//   });

//   mockCharge.mockResolvedValue(gatewayChargeResult);
//   mockRefund.mockResolvedValue(gatewayRefundResult);

//   mockGetOrder.mockResolvedValue(order);
//   mockMarkOrderAsPaid.mockResolvedValue({ success: true });

//   mockRecordEvent.mockResolvedValue(undefined);

//   mockPublishPaymentSuccessful.mockResolvedValue(undefined);
//   mockPublishPaymentFailed.mockResolvedValue(undefined);
//   mockPublishPaymentRefunded.mockResolvedValue(undefined);
// });

// // ============================================================================
// // processPayment
// // ============================================================================

// describe('processPayment', () => {
//   const paymentData = {
//     orderId: 'order-123',
//     amount: 1000,
//     currency: 'USD',
//     paymentMethod: 'CARD',
//     idempotencyKey: 'idempotency-key-123',
//   };

//   it('should process a payment successfully', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     setupSuccessfulTransaction();

//     const result = await paymentService.processPayment(
//       user,
//       paymentData
//     );

//     expect(mockGetOrder).toHaveBeenCalledWith('order-123');

//     expect(mockCharge).toHaveBeenCalled();

//     expect(mockWithTransaction).toHaveBeenCalled();

//     expect(mockPublishPaymentSuccessful).toHaveBeenCalled();

//     expect(result).toBeDefined();
//   });

//   it('should return the existing payment for an idempotent request', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [payment],
//       rowCount: 1,
//     });

//     const result = await paymentService.processPayment(
//       user,
//       paymentData
//     );

//     expect(result).toEqual(payment);

//     expect(mockGetOrder).not.toHaveBeenCalled();
//     expect(mockCharge).not.toHaveBeenCalled();
//     expect(mockWithTransaction).not.toHaveBeenCalled();
//   });

//   it('should reject when the order does not exist', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(null);

//     await expect(
//       paymentService.processPayment(user, paymentData)
//     ).rejects.toThrow();

//     expect(mockCharge).not.toHaveBeenCalled();
//   });

//   it('should reject when the order is cancelled', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue({
//       ...order,
//       status: 'CANCELLED',
//     });

//     await expect(
//       paymentService.processPayment(user, paymentData)
//     ).rejects.toThrow();

//     expect(mockCharge).not.toHaveBeenCalled();
//   });

//   it('should reject when the order has failed', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue({
//       ...order,
//       status: 'FAILED',
//     });

//     await expect(
//       paymentService.processPayment(user, paymentData)
//     ).rejects.toThrow();

//     expect(mockCharge).not.toHaveBeenCalled();
//   });

//   it('should reject when the order is already paid', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue({
//       ...order,
//       status: 'PAID',
//     });

//     await expect(
//       paymentService.processPayment(user, paymentData)
//     ).rejects.toThrow();

//     expect(mockCharge).not.toHaveBeenCalled();
//   });

//   it('should reject when the user does not own the order', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue({
//       ...order,
//       user_id: 'another-user',
//     });

//     await expect(
//       paymentService.processPayment(user, paymentData)
//     ).rejects.toThrow();

//     expect(mockCharge).not.toHaveBeenCalled();
//   });

//   it('should allow an admin to process payment for another user', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue({
//       ...order,
//       user_id: 'another-user',
//     });

//     setupSuccessfulTransaction();

//     await expect(
//       paymentService.processPayment(admin, paymentData)
//     ).resolves.toBeDefined();

//     expect(mockCharge).toHaveBeenCalled();
//   });

//   it('should reject when the payment amount does not match the order total', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(order);

//     await expect(
//       paymentService.processPayment(user, {
//         ...paymentData,
//         amount: 900,
//       })
//     ).rejects.toThrow('does not match order total');

//     expect(mockCharge).not.toHaveBeenCalled();
//     expect(mockWithTransaction).not.toHaveBeenCalled();
//   });

//   it('should reject an invalid payment amount', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(order);

//     await expect(
//       paymentService.processPayment(user, {
//         ...paymentData,
//         amount: 'invalid',
//       })
//     ).rejects.toThrow('Invalid payment amount');

//     expect(mockCharge).not.toHaveBeenCalled();
//     expect(mockWithTransaction).not.toHaveBeenCalled();
//   });

//   it.each([
//     ['zero', 0],
//     ['negative', -100],
//     ['NaN', NaN],
//     ['infinity', Infinity],
//     ['empty string', ''],
//     ['non-numeric string', 'abc'],
//   ])('should reject a %s payment amount', async (_, amount) => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(order);

//     await expect(
//       paymentService.processPayment(user, {
//         ...paymentData,
//         amount,
//       })
//     ).rejects.toThrow();

//     expect(mockCharge).not.toHaveBeenCalled();
//     expect(mockWithTransaction).not.toHaveBeenCalled();
//   });

//   it('should accept a small floating-point difference within the tolerance', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(order);

//     setupSuccessfulTransaction();

//     await expect(
//       paymentService.processPayment(user, {
//         ...paymentData,
//         amount: 1000.005,
//       })
//     ).resolves.toBeDefined();

//     expect(mockCharge).toHaveBeenCalled();
//   });

//   it('should reject a floating-point difference greater than the tolerance', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(order);

//     await expect(
//       paymentService.processPayment(user, {
//         ...paymentData,
//         amount: 1000.02,
//       })
//     ).rejects.toThrow('does not match order total');

//     expect(mockCharge).not.toHaveBeenCalled();
//   });

//   it('should reject when the gateway charge fails', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(order);

//     mockCharge.mockResolvedValue({
//       success: false,
//       error: 'Card declined',
//     });

//     await expect(
//       paymentService.processPayment(user, paymentData)
//     ).rejects.toThrow();

//     expect(mockPublishPaymentFailed).toHaveBeenCalled();
//     expect(mockPublishPaymentSuccessful).not.toHaveBeenCalled();
//   });

//   it('should not create a payment transaction when the gateway charge fails', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(order);

//     mockCharge.mockResolvedValue({
//       success: false,
//       error: 'Card declined',
//     });

//     await expect(
//       paymentService.processPayment(user, paymentData)
//     ).rejects.toThrow();

//     expect(mockWithTransaction).not.toHaveBeenCalled();
//   });

//   it('should use the order currency when the request does not specify one', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue({
//       ...order,
//       currency: 'NPR',
//     });

//     setupSuccessfulTransaction();

//     await paymentService.processPayment(user, {
//       ...paymentData,
//       currency: undefined,
//     });

//     expect(mockCharge).toHaveBeenCalledWith(
//       expect.objectContaining({
//         currency: 'NPR',
//       })
//     );
//   });

//   it('should use the supplied currency when provided', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     mockGetOrder.mockResolvedValue(order);

//     setupSuccessfulTransaction();

//     await paymentService.processPayment(user, {
//       ...paymentData,
//       currency: 'EUR',
//     });

//     expect(mockCharge).toHaveBeenCalledWith(
//       expect.objectContaining({
//         currency: 'EUR',
//       })
//     );
//   });
// });

// // ============================================================================
// // refundPayment
// // ============================================================================

// describe('refundPayment', () => {
//   it('should refund a captured payment successfully', async () => {
//     setupPaymentLookup(capturedPayment);
//     setupSuccessfulTransaction();

//     const result = await paymentService.refundPayment(
//       payment.id,
//       admin,
//       { amount: 1000 }
//     );

//     expect(mockRefund).toHaveBeenCalled();

//     expect(mockWithTransaction).toHaveBeenCalled();

//     expect(mockPublishPaymentRefunded).toHaveBeenCalled();

//     expect(result).toBeDefined();
//   });

//   it('should reject a refund from a non-admin user', async () => {
//     setupPaymentLookup(capturedPayment);

//     await expect(
//       paymentService.refundPayment(payment.id, user, {
//         amount: 1000,
//       })
//     ).rejects.toThrow();

//     expect(mockRefund).not.toHaveBeenCalled();
//     expect(mockWithTransaction).not.toHaveBeenCalled();
//   });

//   it('should reject when the payment does not exist', async () => {
//     mockQuery.mockResolvedValue({
//       rows: [],
//       rowCount: 0,
//     });

//     await expect(
//       paymentService.refundPayment(payment.id, admin, {
//         amount: 1000,
//       })
//     ).rejects.toThrow();

//     expect(mockRefund).not.toHaveBeenCalled();
//   });

//   it('should reject when the payment is not captured', async () => {
//     setupPaymentLookup({
//       ...payment,
//       status: 'PENDING',
//     });

//     await expect(
//       paymentService.refundPayment(payment.id, admin, {
//         amount: 1000,
//       })
//     ).rejects.toThrow();

//     expect(mockRefund).not.toHaveBeenCalled();
//   });

//   it('should reject a zero refund amount', async () => {
//     setupPaymentLookup(capturedPayment);

//     await expect(
//       paymentService.refundPayment(payment.id, admin, {
//         amount: 0,
//       })
//     ).rejects.toThrow('Invalid refund amount');

//     expect(mockRefund).not.toHaveBeenCalled();
//     expect(mockWithTransaction).not.toHaveBeenCalled();
//     expect(mockPublishPaymentRefunded).not.toHaveBeenCalled();
//   });

//   it.each([
//     ['zero', 0],
//     ['negative', -100],
//     ['greater than payment amount', 1500],
//     ['invalid string', 'invalid'],
//     ['NaN', NaN],
//     ['infinity', Infinity],
//     ['empty string', ''],
//   ])('should reject a %s refund amount', async (_, amount) => {
//     setupPaymentLookup(capturedPayment);

//     await expect(
//       paymentService.refundPayment(payment.id, admin, {
//         amount,
//       })
//     ).rejects.toThrow('Invalid refund amount');

//     expect(mockRefund).not.toHaveBeenCalled();
//     expect(mockWithTransaction).not.toHaveBeenCalled();
//     expect(mockPublishPaymentRefunded).not.toHaveBeenCalled();
//   });

//   it('should refund the full payment when no amount is supplied', async () => {
//     setupPaymentLookup(capturedPayment);
//     setupSuccessfulTransaction();

//     await paymentService.refundPayment(payment.id, admin, {});

//     expect(mockRefund).toHaveBeenCalled();

//     expect(mockRefund).toHaveBeenCalledWith(
//       expect.objectContaining({
//         amount: 1000,
//       })
//     );
//   });

//   it('should allow a partial refund amount', async () => {
//     setupPaymentLookup(capturedPayment);
//     setupSuccessfulTransaction();

//     await paymentService.refundPayment(payment.id, admin, {
//       amount: 500,
//     });

//     expect(mockRefund).toHaveBeenCalledWith(
//       expect.objectContaining({
//         amount: 500,
//       })
//     );
//   });

//   it('should reject refunding a payment that has already been refunded', async () => {
//     setupPaymentLookup({
//       ...payment,
//       status: 'REFUNDED',
//     });

//     await expect(
//       paymentService.refundPayment(payment.id, admin, {
//         amount: 1000,
//       })
//     ).rejects.toThrow();

//     expect(mockRefund).not.toHaveBeenCalled();
//   });

//   it('should reject when the payment gateway refund fails', async () => {
//     setupPaymentLookup(capturedPayment);

//     mockRefund.mockResolvedValue({
//       success: false,
//       error: 'Refund failed',
//     });

//     await expect(
//       paymentService.refundPayment(payment.id, admin, {
//         amount: 1000,
//       })
//     ).rejects.toThrow();

//     expect(mockWithTransaction).not.toHaveBeenCalled();
//     expect(mockPublishPaymentRefunded).not.toHaveBeenCalled();
//   });
// });

// // ============================================================================
// // getPaymentById
// // ============================================================================

// describe('getPaymentById', () => {
//   it('should return a payment by ID', async () => {
//     setupPaymentLookup(payment);

//     const result = await paymentService.getPaymentById(
//       payment.id,
//       user
//     );

//     expect(result).toBeDefined();

//     expect(mockQuery).toHaveBeenCalled();
//   });

//   it('should throw when the payment does not exist', async () => {
//     mockQuery.mockResolvedValue({
//       rows: [],
//       rowCount: 0,
//     });

//     await expect(
//       paymentService.getPaymentById(payment.id, user)
//     ).rejects.toThrow();
//   });

//   it('should reject access when the user does not own the payment', async () => {
//     setupPaymentLookup({
//       ...payment,
//       user_id: 'another-user',
//     });

//     await expect(
//       paymentService.getPaymentById(payment.id, user)
//     ).rejects.toThrow();
//   });

//   it('should allow an admin to retrieve another user payment', async () => {
//     setupPaymentLookup({
//       ...payment,
//       user_id: 'another-user',
//     });

//     const result = await paymentService.getPaymentById(
//       payment.id,
//       admin
//     );

//     expect(result).toBeDefined();
//   });
// });

// // ============================================================================
// // getPaymentByOrderId
// // ============================================================================

// describe('getPaymentByOrderId', () => {
//   it('should return a payment by order ID', async () => {
//     setupPaymentLookup(payment);

//     const result = await paymentService.getPaymentByOrderId(
//       payment.order_id,
//       user
//     );

//     expect(result).toBeDefined();

//     expect(mockQuery).toHaveBeenCalled();
//   });

//   it('should throw when no payment exists for the order', async () => {
//     mockQuery.mockResolvedValue({
//       rows: [],
//       rowCount: 0,
//     });

//     await expect(
//       paymentService.getPaymentByOrderId(
//         payment.order_id,
//         user
//       )
//     ).rejects.toThrow();
//   });

//   it('should reject access when the user does not own the payment', async () => {
//     setupPaymentLookup({
//       ...payment,
//       user_id: 'another-user',
//     });

//     await expect(
//       paymentService.getPaymentByOrderId(
//         payment.order_id,
//         user
//       )
//     ).rejects.toThrow();
//   });

//   it('should allow an admin to retrieve another user payment by order ID', async () => {
//     setupPaymentLookup({
//       ...payment,
//       user_id: 'another-user',
//     });

//     const result = await paymentService.getPaymentByOrderId(
//       payment.order_id,
//       admin
//     );

//     expect(result).toBeDefined();
//   });
// });

// // ============================================================================
// // listPayments
// // ============================================================================

// describe('listPayments', () => {
//   const paymentRows = [
//     payment,
//     {
//       ...payment,
//       id: 'payment-456',
//       order_id: 'order-456',
//     },
//   ];

//   it('should return a list of payments for an admin', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: paymentRows,
//       rowCount: 2,
//     });

//     const result = await paymentService.listPayments(admin, {});

//     expect(result).toBeDefined();

//     expect(mockQuery).toHaveBeenCalled();
//   });

//   it('should restrict regular users to their own payments', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [payment],
//       rowCount: 1,
//     });

//     await paymentService.listPayments(user, {});

//     const [sql, params] = mockQuery.mock.calls[0];

//     expect(sql).toContain('user_id');

//     expect(params).toContain(user.id);
//   });

//   it('should filter payments by status', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [payment],
//       rowCount: 1,
//     });

//     await paymentService.listPayments(admin, {
//       status: 'CAPTURED',
//     });

//     const [sql, params] = mockQuery.mock.calls[0];

//     expect(sql).toContain('status');

//     expect(params).toContain('CAPTURED');
//   });

//   it('should filter payments by order ID', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [payment],
//       rowCount: 1,
//     });

//     await paymentService.listPayments(admin, {
//       order_id: 'order-123',
//     });

//     const [sql, params] = mockQuery.mock.calls[0];

//     expect(sql).toContain('order_id');

//     expect(params).toContain('order-123');
//   });

//   it('should filter payments by payment method', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [payment],
//       rowCount: 1,
//     });

//     await paymentService.listPayments(admin, {
//       payment_method: 'CARD',
//     });

//     const [sql, params] = mockQuery.mock.calls[0];

//     expect(sql).toContain('payment_method');

//     expect(params).toContain('CARD');
//   });

//   it('should support pagination', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: paymentRows,
//       rowCount: 2,
//     });

//     await paymentService.listPayments(admin, {
//       page: 2,
//       limit: 10,
//     });

//     const [sql] = mockQuery.mock.calls[0];

//     expect(sql).toContain('LIMIT');
//     expect(sql).toContain('OFFSET');
//   });

//   it('should use default pagination when no pagination is supplied', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: paymentRows,
//       rowCount: 2,
//     });

//     await paymentService.listPayments(admin, {});

//     expect(mockQuery).toHaveBeenCalled();
//   });

//   it('should support sorting by an allowed column', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: paymentRows,
//       rowCount: 2,
//     });

//     await paymentService.listPayments(admin, {
//       sortBy: 'created_at',
//       sortOrder: 'DESC',
//     });

//     const [sql] = mockQuery.mock.calls[0];

//     expect(sql).toContain('created_at');
//     expect(sql).toContain('DESC');
//   });

//   it('should not allow arbitrary SQL as a sort column', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: paymentRows,
//       rowCount: 2,
//     });

//     await paymentService.listPayments(admin, {
//       sortBy: 'created_at; DROP TABLE payments; --',
//     });

//     const [sql] = mockQuery.mock.calls[0];

//     expect(sql).not.toContain('DROP TABLE');
//   });

//   it('should return an empty list when no payments exist', async () => {
//     mockQuery.mockResolvedValueOnce({
//       rows: [],
//       rowCount: 0,
//     });

//     const result = await paymentService.listPayments(admin, {});

//     expect(result).toBeDefined();
//   });
// });






















// payment.servic// src/__test__/unit/payment.service.test.js
import { jest } from '@jest/globals';
import { AppError } from '../../middleware/errorHandler.js';

// 1. Mock dependencies before importing the service
jest.unstable_mockModule('../../config/db.js', () => ({
  query: jest.fn(),
  withTransaction: jest.fn((callback) => {
    const mockClient = {
      query: jest.fn(),
    };
    return callback(mockClient);
  }),
}));

jest.unstable_mockModule('../../services/mockGateway.js', () => ({
  default: {
    charge: jest.fn(),
    refund: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/order.client.js', () => ({
  default: {
    getOrder: jest.fn(),
    markOrderAsPaid: jest.fn(),
  },
}));

jest.unstable_mockModule('../../services/outbox.service.js', () => ({
  default: {
    recordEvent: jest.fn(),
  },
}));

jest.unstable_mockModule('../../events/publishers/payment.publisher.js', () => ({
  default: {
    publishPaymentSuccessful: jest.fn().mockResolvedValue(true),
    publishPaymentFailed: jest.fn().mockResolvedValue(true),
    publishPaymentRefunded: jest.fn().mockResolvedValue(true),
  },
}));

jest.unstable_mockModule('../../utils/logger.js', () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Dynamic import after mocks are registered
const { query, withTransaction } = await import('../../config/db.js');
const { default: mockGateway } = await import('../../services/mockGateway.js');
const { default: orderClient } = await import('../../services/order.client.js');
const { default: outboxService } = await import('../../services/outbox.service.js');
const { default: paymentPublisher } = await import('../../events/publishers/payment.publisher.js');
const { paymentService } = await import('../../services/payment.service.js');

describe('PaymentService Unit Tests', () => {
  const mockUser = { id: 'usr-100', roles: ['customer'] };
  const mockAdmin = { id: 'adm-999', roles: ['admin'] };

  const validOrder = {
    id: 1,
    order_number: 'ORD-2026-0001',
    user_id: 'usr-100',
    total_amount: '99.99',
    currency: 'USD',
    status: 'PENDING',
    payment_status: 'PENDING',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Default fallback so query(...) always resolves to { rows: [] }
    query.mockResolvedValue({ rows: [] });
  });

  // =========================================================================
  // processPayment()
  // =========================================================================
  describe('processPayment', () => {
    const paymentData = {
      order_id: 1,
      amount: '99.99',
      currency: 'USD',
      payment_method: 'MOCK_CARD',
      idempotency_key: 'idem-key-123',
    };

    it('should return existing payment if idempotency key is already cached', async () => {
      const existingPayment = { id: 10, idempotency_key: 'idem-key-123', status: 'CAPTURED' };
      query.mockResolvedValueOnce({ rows: [existingPayment] });

      const result = await paymentService.processPayment(mockUser, paymentData);

      expect(query).toHaveBeenCalledWith(
        'SELECT * FROM payments WHERE idempotency_key = $1',
        ['idem-key-123']
      );
      expect(result).toEqual(existingPayment);
      expect(orderClient.getOrder).not.toHaveBeenCalled();
      expect(mockGateway.charge).not.toHaveBeenCalled();
    });

    it('should throw 400 if order status is CANCELLED or FAILED', async () => {
      orderClient.getOrder.mockResolvedValueOnce({ ...validOrder, status: 'CANCELLED' });

      await expect(paymentService.processPayment(mockUser, paymentData)).rejects.toThrow(
        "Cannot pay for an order with status 'CANCELLED'"
      );
    });

    it('should throw 400 if order is already paid', async () => {
      orderClient.getOrder.mockResolvedValueOnce({ ...validOrder, payment_status: 'PAID' });
      console.log('data;- ', paymentService.processPayment)


      await expect(paymentService.processPayment(mockUser, paymentData)).rejects.toThrow(
        'is already paid'
      );
    });

    it('should throw 403 if user is neither owner of the order nor an admin', async () => {
      orderClient.getOrder.mockResolvedValueOnce({ ...validOrder, user_id: 'different-user' });

      await expect(paymentService.processPayment(mockUser, paymentData)).rejects.toThrow(
        'Forbidden: You can only make payments for your own orders.'
      );
    });

    it('should throw 400 if charge amount does not match order total amount', async () => {
      orderClient.getOrder.mockResolvedValueOnce(validOrder);

      const mismatchedData = { ...paymentData, amount: '50.00' };

      await expect(paymentService.processPayment(mockUser, mismatchedData)).rejects.toThrow(
        'does not match order total'
      );
    });

    it('should successfully process payment, notify order service, record outbox, and publish event', async () => {
      orderClient.getOrder.mockResolvedValueOnce(validOrder);

      mockGateway.charge.mockResolvedValueOnce({
        success: true,
        transaction_id: 'gw-tx-12345',
        gateway_response: { status: 'approved' },
      });

      const insertedPayment = {
        id: 101,
        payment_reference: 'PAY-20261113-ABCDEF',
        order_id: 1,
        order_number: validOrder.order_number,
        user_id: mockUser.id,
        amount: 99.99,
        status: 'CAPTURED',
        provider_transaction_id: 'gw-tx-12345',
      };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [insertedPayment] }) // Insert payment
          .mockResolvedValueOnce({ rows: [] }), // Insert transaction
      };

      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));
      orderClient.markOrderAsPaid.mockResolvedValueOnce({ success: true });

      const result = await paymentService.processPayment(mockUser, paymentData);

      expect(mockGateway.charge).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 99.99,
          currency: 'USD',
          payment_method: 'MOCK_CARD',
        })
      );
      expect(mockClient.query).toHaveBeenCalledTimes(2);
      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        mockClient,
        'Payment',
        insertedPayment.id,
        'payment.successful',
        expect.any(Object)
      );
      expect(orderClient.markOrderAsPaid).toHaveBeenCalledWith(validOrder.id, insertedPayment);
      expect(paymentPublisher.publishPaymentSuccessful).toHaveBeenCalledWith(insertedPayment);
      expect(result).toEqual(insertedPayment);
    });

    it('should allow admin to process payment for an order owned by another user', async () => {
      orderClient.getOrder.mockResolvedValueOnce({ ...validOrder, user_id: 'customer-456' });

      mockGateway.charge.mockResolvedValueOnce({
        success: true,
        transaction_id: 'gw-tx-999',
        gateway_response: { status: 'approved' },
      });

      const insertedPayment = {
        id: 102,
        payment_reference: 'PAY-20261113-XYZ999',
        order_id: 1,
        status: 'CAPTURED',
      };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [insertedPayment] })
          .mockResolvedValueOnce({ rows: [] }),
      };

      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));
      orderClient.markOrderAsPaid.mockResolvedValueOnce({ success: true });

      const result = await paymentService.processPayment(mockAdmin, paymentData);

      expect(result).toEqual(insertedPayment);
      expect(orderClient.markOrderAsPaid).toHaveBeenCalled();
    });

    it('should record failed payment, publish payment.failed event, and throw 400 when gateway charge fails', async () => {
      orderClient.getOrder.mockResolvedValueOnce(validOrder);

      mockGateway.charge.mockResolvedValueOnce({
        success: false,
        error_code: 'INSUFFICIENT_FUNDS',
        error_message: 'Insufficient balance in card account',
        transaction_id: 'gw-tx-fail',
        gateway_response: { status: 'declined' },
      });

      const failedPayment = {
        id: 103,
        payment_reference: 'PAY-20261113-FAILED',
        order_id: 1,
        status: 'FAILED',
        error_code: 'INSUFFICIENT_FUNDS',
        error_message: 'Insufficient balance in card account',
      };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [failedPayment] })
          .mockResolvedValueOnce({ rows: [] }),
      };

      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      await expect(paymentService.processPayment(mockUser, paymentData)).rejects.toThrow(
        'Insufficient balance in card account'
      );
      expect(paymentPublisher.publishPaymentFailed).toHaveBeenCalledWith(failedPayment);
      expect(orderClient.markOrderAsPaid).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // refundPayment()
  // =========================================================================
  describe('refundPayment', () => {
    const existingCapturedPayment = {
      id: 200,
      payment_reference: 'PAY-20261113-REFUNDME',
      amount: '150.00',
      currency: 'USD',
      status: 'CAPTURED',
      provider_transaction_id: 'gw-tx-captured',
      user_id: 'usr-100',
    };

    it('should throw 403 if non-admin user attempts to authorize a refund', async () => {
      await expect(paymentService.refundPayment(200, mockUser, { amount: '50.00' })).rejects.toThrow(
        'Forbidden: Only store administrators can authorize refunds.'
      );
    });

    it('should throw 400 if payment status is not CAPTURED', async () => {
      jest.spyOn(paymentService, 'getPaymentById').mockResolvedValueOnce({
        ...existingCapturedPayment,
        status: 'FAILED',
      });

      await expect(
        paymentService.refundPayment(200, mockAdmin, { amount: '50.00' })
      ).rejects.toThrow("Cannot refund a payment with status 'FAILED'");
    });

    it('should throw 400 if refund amount is negative, zero, or exceeds payment total', async () => {
      jest.spyOn(paymentService, 'getPaymentById').mockResolvedValueOnce(existingCapturedPayment);

      await expect(
        paymentService.refundPayment(200, mockAdmin, { amount: '0' })
      ).rejects.toThrow('Invalid refund amount');

      jest.spyOn(paymentService, 'getPaymentById').mockResolvedValueOnce(existingCapturedPayment);

      await expect(
        paymentService.refundPayment(200, mockAdmin, { amount: '200.00' })
      ).rejects.toThrow('Invalid refund amount');
    });

    it('should execute refund, update payment status to REFUNDED, record outbox event, and publish event', async () => {
      jest.spyOn(paymentService, 'getPaymentById').mockResolvedValueOnce(existingCapturedPayment);

      mockGateway.refund.mockResolvedValueOnce({
        success: true,
        refund_id: 'gw-ref-111',
      });

      const refundRecord = {
        id: 1,
        refund_reference: 'REF-20261113-AAAAAA',
        payment_id: 200,
        amount: 50.0,
        currency: 'USD',
        reason: 'Customer return',
        status: 'COMPLETED',
      };

      const mockClient = {
        query: jest
          .fn()
          .mockResolvedValueOnce({ rows: [refundRecord] }) // Insert refund
          .mockResolvedValueOnce({ rows: [] }) // Update payments
          .mockResolvedValueOnce({ rows: [] }), // Insert transaction
      };

      withTransaction.mockImplementationOnce(async (callback) => callback(mockClient));

      const result = await paymentService.refundPayment(200, mockAdmin, {
        amount: '50.00',
        reason: 'Customer return',
      });

      expect(mockGateway.refund).toHaveBeenCalledWith({
        payment_id: 200,
        transaction_id: 'gw-tx-captured',
        amount: 50.0,
      });
      expect(mockClient.query).toHaveBeenCalledTimes(3);
      expect(outboxService.recordEvent).toHaveBeenCalledWith(
        mockClient,
        'Payment',
        200,
        'payment.refunded',
        expect.any(Object)
      );
      expect(paymentPublisher.publishPaymentRefunded).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'REFUNDED' }),
        refundRecord
      );
      expect(result.payment.status).toBe('REFUNDED');
      expect(result.refund).toEqual(refundRecord);
    });
  });

  // =========================================================================
  // getPaymentById()
  // =========================================================================
  describe('getPaymentById', () => {
    it('should throw 404 if payment does not exist', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(paymentService.getPaymentById(999, mockUser)).rejects.toThrow(
        'Payment not found'
      );
    });

    it('should throw 403 if requesting user is neither owner nor admin', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1, user_id: 'other-user', amount: '10.00' }],
      });

      await expect(paymentService.getPaymentById(1, mockUser)).rejects.toThrow(
        'Forbidden: You can only view your own payment records.'
      );
    });

    it('should return payment if requesting user is the owner', async () => {
      const paymentRow = { id: 1, user_id: 'usr-100', amount: '10.00', transactions: [], refunds: [] };
      query.mockResolvedValueOnce({ rows: [paymentRow] });

      const result = await paymentService.getPaymentById(1, mockUser);
      expect(result).toEqual(paymentRow);
    });

    it('should return payment if requesting user is an admin', async () => {
      const paymentRow = { id: 1, user_id: 'other-user', amount: '10.00', transactions: [], refunds: [] };
      query.mockResolvedValueOnce({ rows: [paymentRow] });

      const result = await paymentService.getPaymentById(1, mockAdmin);
      expect(result).toEqual(paymentRow);
    });
  });

  // =========================================================================
  // getPaymentByOrderId()
  // =========================================================================
  describe('getPaymentByOrderId', () => {
    it('should throw 404 if no payment found for order', async () => {
      query.mockResolvedValueOnce({ rows: [] });

      await expect(paymentService.getPaymentByOrderId(555, mockUser)).rejects.toThrow(
        'No payment found for order #555'
      );
    });

    it('should throw 403 if user is not owner of the payment and not admin', async () => {
      query.mockResolvedValueOnce({
        rows: [{ id: 1, order_id: 555, user_id: 'diff-user' }],
      });

      await expect(paymentService.getPaymentByOrderId(555, mockUser)).rejects.toThrow(
        'Forbidden: You can only view your own payment records.'
      );
    });

    it('should return payment for order if user owns it', async () => {
      const paymentRow = { id: 1, order_id: 555, user_id: 'usr-100', transactions: [] };
      query.mockResolvedValueOnce({ rows: [paymentRow] });

      const result = await paymentService.getPaymentByOrderId(555, mockUser);
      expect(result).toEqual(paymentRow);
    });
  });

  // =========================================================================
  // listPayments()
  // =========================================================================
  describe('listPayments', () => {
    it('should automatically scope payment query to user ID for non-admin customers', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 1 }] }) // count query
        .mockResolvedValueOnce({ rows: [{ id: 1, user_id: 'usr-100' }] }); // data query

      const result = await paymentService.listPayments({ page: 1, limit: 10 }, mockUser);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('p.user_id = $1'),
        ['usr-100']
      );
      expect(result.payments).toHaveLength(1);
      expect(result.pagination).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
    });

    it('should allow admin to filter payments by user_id, status, and order_id', async () => {
      query
        .mockResolvedValueOnce({ rows: [{ total: 2 }] })
        .mockResolvedValueOnce({
          rows: [
            { id: 1, status: 'CAPTURED', order_id: 10 },
            { id: 2, status: 'CAPTURED', order_id: 10 },
          ],
        });

      const filters = {
        user_id: 'target-user',
        status: 'CAPTURED',
        order_id: 10,
        payment_method: 'MOCK_CARD',
        page: 1,
        limit: 20,
        sort_by: 'amount',
        sort_order: 'asc',
      };

      const result = await paymentService.listPayments(filters, mockAdmin);

      expect(query).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/p\.user_id = \$1 AND p\.status = \$2 AND p\.order_id = \$3 AND p\.payment_method = \$4/),
        ['target-user', 'CAPTURED', 10, 'MOCK_CARD']
      );
      expect(result.payments).toHaveLength(2);
      expect(result.pagination.total).toBe(2);
    });
  });
});