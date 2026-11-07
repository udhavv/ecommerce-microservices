// payment.service.js
import { query, withTransaction } from '../config/db.js';
import mockGateway from './mockGateway.js';
import orderClient from './order.client.js';
import outboxService from './outbox.service.js';
import paymentPublisher from '../events/publishers/payment.publisher.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const paymentService = {
  /**
   * Process a mock payment for an order
   */
  async processPayment(user, data) {
    const idempotencyKey = data.idempotency_key;

    // 1. Idempotency Check
    if (idempotencyKey) {
      const existing = await query('SELECT * FROM payments WHERE idempotency_key = $1', [idempotencyKey]);
      if (existing.rows.length > 0) {
        logger.info({ idempotencyKey, paymentId: existing.rows[0].id }, 'Returning existing payment for idempotency key');
        return existing.rows[0];
      }
    }

    // 2. Cross-Service Verification: Verify order exists in Order Service
    const order = await orderClient.getOrder(data.order_id);

    if (order.status === 'CANCELLED' || order.status === 'FAILED') {
      throw new AppError(`Cannot pay for an order with status '${order.status}'`, 400);
    }

    if (order.payment_status === 'PAID') {
      throw new AppError(`Order #${order.order_number} is already paid.`, 400);
    }

    // Customer security: Verify user owns the order (or is admin)
    const isOwner = String(order.user_id) === String(user.id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');
    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only make payments for your own orders.', 403);
    }

    // Verify amount matches order total
    const orderTotal = parseFloat(order.total_amount);
    const chargeAmount = parseFloat(data.amount);
    if (Math.abs(orderTotal - chargeAmount) > 0.01) {
      throw new AppError(
        `Payment amount ($${chargeAmount}) does not match order total ($${orderTotal}).`,
        400
      );
    }

    // 3. Generate Unique Payment Reference
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const paymentReference = `PAY-${datePrefix}-${randomSuffix}`;

    // 4. Execute Charge in Mock Payment Gateway
    const gatewayResult = await mockGateway.charge({
      amount: chargeAmount,
      currency: data.currency || order.currency || 'USD',
      payment_method: data.payment_method || 'MOCK_CARD',
      card_number: data.card_number,
      mock_action: data.mock_action || 'SUCCESS',
    });

    const isSuccess = gatewayResult.success === true;
    const paymentStatus = isSuccess ? 'CAPTURED' : 'FAILED';

    // 5. Persist Payment, Ledger Transaction, and Outbox in an Atomic Transaction
    const payment = await withTransaction(async (client) => {
      const insertSql = `
        INSERT INTO payments (
          payment_reference,
          order_id,
          order_number,
          user_id,
          amount,
          currency,
          status,
          payment_method,
          provider,
          provider_transaction_id,
          idempotency_key,
          error_code,
          error_message,
          metadata,
          captured_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'MOCK_GATEWAY', $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;

      const paymentRes = await client.query(insertSql, [
        paymentReference,
        order.id,
        order.order_number,
        user.id,
        chargeAmount,
        data.currency || 'USD',
        paymentStatus,
        data.payment_method || 'MOCK_CARD',
        gatewayResult.transaction_id,
        idempotencyKey || null,
        gatewayResult.error_code || null,
        gatewayResult.error_message || null,
        gatewayResult.gateway_response || {},
        isSuccess ? new Date() : null,
      ]);

      const record = paymentRes.rows[0];

      // Insert Audit Ledger Transaction
      await client.query(
        `INSERT INTO payment_transactions 
          (payment_id, transaction_type, amount, status, gateway_response)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          record.id,
          isSuccess ? 'CAPTURE' : 'DECLINE',
          chargeAmount,
          isSuccess ? 'SUCCESS' : 'FAILURE',
          gatewayResult.gateway_response || {},
        ]
      );

      // Record Transactional Outbox Event
      const eventType = isSuccess ? 'payment.successful' : 'payment.failed';
      await outboxService.recordEvent(client, 'Payment', record.id, eventType, {
        payment_id: String(record.id),
        payment_reference: record.payment_reference,
        order_id: String(record.order_id),
        order_number: record.order_number,
        user_id: record.user_id,
        amount: record.amount,
        status: record.status,
        provider_transaction_id: record.provider_transaction_id,
        error_code: record.error_code,
        error_message: record.error_message,
      });

      return record;
    });

    // 6. Cross-Service Synchronization with Order Service
    if (isSuccess) {
      // Notify Order Service to transition status to PAID / CONFIRMED and finalize stock hold
      await orderClient.markOrderAsPaid(order.id, payment);

      // Publish event to RabbitMQ
      paymentPublisher.publishPaymentSuccessful(payment).catch(() => {});
      logger.info({ paymentReference, orderId: order.id }, 'Payment completed and order updated');
      return payment;
    } else {
      // Publish failed event
      paymentPublisher.publishPaymentFailed(payment).catch(() => {});
      throw new AppError(
        gatewayResult.error_message || 'Payment simulation declined by mock bank',
        400,
        {
          payment_reference: payment.payment_reference,
          error_code: gatewayResult.error_code,
        }
      );
    }
  },

  /**
   * Process a refund for a captured payment
   */
  async refundPayment(id, user, data = {}) {
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');
    if (!isAdmin) {
      throw new AppError('Forbidden: Only store administrators can authorize refunds.', 403);
    }

    const payment = await this.getPaymentById(id, user);

    if (payment.status !== 'CAPTURED') {
      throw new AppError(`Cannot refund a payment with status '${payment.status}'`, 400);
    }

    const refundAmount = data.amount ? parseFloat(data.amount) : parseFloat(payment.amount);
    if (refundAmount <= 0 || refundAmount > parseFloat(payment.amount)) {
      throw new AppError(`Invalid refund amount ($${refundAmount})`, 400);
    }

    const gatewayRefund = await mockGateway.refund({
      payment_id: payment.id,
      transaction_id: payment.provider_transaction_id,
      amount: refundAmount,
    });

    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const refundRef = `REF-${datePrefix}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const result = await withTransaction(async (client) => {
      // Insert Refund record
      const refRes = await client.query(
        `INSERT INTO payment_refunds (refund_reference, payment_id, amount, currency, reason, status)
         VALUES ($1, $2, $3, $4, $5, 'COMPLETED')
         RETURNING *`,
        [refundRef, payment.id, refundAmount, payment.currency, data.reason || 'Admin refund']
      );

      const refundRecord = refRes.rows[0];

      // Update payment status
      await client.query(
        `UPDATE payments 
         SET status = 'REFUNDED', 
             refunded_at = NOW(), 
             updated_at = NOW() 
         WHERE id = $1`,
        [payment.id]
      );

      // Record transaction
      await client.query(
        `INSERT INTO payment_transactions (payment_id, transaction_type, amount, status, gateway_response)
         VALUES ($1, 'REFUND', $2, 'SUCCESS', $3)`,
        [payment.id, refundAmount, gatewayRefund]
      );

      // Record outbox event
      await outboxService.recordEvent(client, 'Payment', payment.id, 'payment.refunded', {
        payment_id: String(payment.id),
        payment_reference: payment.payment_reference,
        refund_reference: refundRecord.refund_reference,
        refunded_amount: refundAmount,
        reason: refundRecord.reason,
      });

      return {
        payment: { ...payment, status: 'REFUNDED' },
        refund: refundRecord,
      };
    });

    paymentPublisher.publishPaymentRefunded(result.payment, result.refund).catch(() => {});
    return result;
  },

  /**
   * Get payment by ID with transaction ledger
   */
  async getPaymentById(id, user) {
    const res = await query(
      `SELECT p.*,
        COALESCE(
          (
            SELECT json_agg(pt.* ORDER BY pt.created_at ASC)
            FROM payment_transactions pt
            WHERE pt.payment_id = p.id
          ), '[]'
        ) AS transactions,
        COALESCE(
          (
            SELECT json_agg(pr.* ORDER BY pr.created_at ASC)
            FROM payment_refunds pr
            WHERE pr.payment_id = p.id
          ), '[]'
        ) AS refunds
       FROM payments p
       WHERE p.id = $1
       GROUP BY p.id`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new AppError('Payment not found', 404);
    }

    const payment = res.rows[0];
    const isOwner = String(payment.user_id) === String(user.id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only view your own payment records.', 403);
    }

    return payment;
  },

  /**
   * Get payment for a specific order
   */
  async getPaymentByOrderId(orderId, user) {
    const res = await query(
      `SELECT p.*,
        COALESCE(
          (
            SELECT json_agg(pt.* ORDER BY pt.created_at ASC)
            FROM payment_transactions pt
            WHERE pt.payment_id = p.id
          ), '[]'
        ) AS transactions
       FROM payments p
       WHERE p.order_id = $1
       ORDER BY p.created_at DESC
       LIMIT 1`,
      [orderId]
    );

    if (res.rows.length === 0) {
      throw new AppError(`No payment found for order #${orderId}`, 404);
    }

    const payment = res.rows[0];
    const isOwner = String(payment.user_id) === String(user.id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');

    if (!isOwner && !isAdmin) {
      throw new AppError('Forbidden: You can only view your own payment records.', 403);
    }

    return payment;
  },

  /**
   * List payments with filtering & pagination
   */
  async listPayments(filters, user) {
    const {
      page = 1,
      limit = 20,
      status,
      order_id,
      user_id,
      payment_method,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');

    if (!isAdmin) {
      params.push(user.id);
      conditions.push(`p.user_id = $${params.length}`);
    } else if (user_id) {
      params.push(user_id);
      conditions.push(`p.user_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`p.status = $${params.length}`);
    }

    if (order_id) {
      params.push(order_id);
      conditions.push(`p.order_id = $${params.length}`);
    }

    if (payment_method) {
      params.push(payment_method);
      conditions.push(`p.payment_method = $${params.length}`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countRes = await query(`SELECT COUNT(*)::int AS total FROM payments p ${whereClause}`, params);
    const total = countRes.rows[0]?.total || 0;

    const validCols = ['created_at', 'amount', 'status', 'id'];
    const sortCol = validCols.includes(sort_by) ? sort_by : 'created_at';
    const sortDir = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const sql = `
      SELECT p.*
      FROM payments p
      ${whereClause}
      ORDER BY p.${sortCol} ${sortDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataRes = await query(sql, [...params, limit, offset]);

    return {
      payments: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },
};

export default paymentService;
