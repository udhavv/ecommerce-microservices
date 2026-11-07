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