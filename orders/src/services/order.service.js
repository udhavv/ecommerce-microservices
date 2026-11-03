import { query, withTransaction } from '../config/db.js';
import productClient from './product.client.js';
import inventoryClient from './inventory.client.js';
import idempotencyService from './idempotency.service.js';
import outboxService from './outbox.service.js';
import orderPublisher from '../events/publishers/order.publisher.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const orderService = {
  /**
   * Create an order with multi-service validation, inventory reservation, and atomic outbox
   */
  async createOrder(user, data) {
    const idempotencyKey = data.idempotency_key;

    // 1. Idempotency Guard
    if (idempotencyKey) {
      const existingOrder = await idempotencyService.findOrderByKey(idempotencyKey);
      if (existingOrder) {
        logger.info({ idempotencyKey, orderId: existingOrder.id }, 'Returning existing order for idempotency key');
        return existingOrder;
      }
    }

    // 2. Validate Items and Snapshot Prices from Product Service
    const verifiedItems = [];
    for (const item of data.items) {
      const verified = await productClient.validateOrderItem(item.product_id, item.variant_id);
      const quantity = Math.max(1, parseInt(item.quantity, 10));
      const lineTotal = Math.round(verified.unit_price * quantity * 100) / 100;

      verifiedItems.push({
        ...verified,
        quantity,
        line_total: lineTotal,
      });
    }

    // 3. Calculate Financial Totals
    const subtotal = verifiedItems.reduce((acc, i) => acc + i.line_total, 0);
    const shippingFee = subtotal >= 50 ? 0.0 : 5.0; // Free shipping over $50
    const taxAmount = Math.round(subtotal * 0.08 * 100) / 100; // 8% tax
    const discountAmount = 0.0;
    const totalAmount = Math.round((subtotal + shippingFee + taxAmount - discountAmount) * 100) / 100;

    // 4. Generate Unique Order Number (e.g. ORD-20261102-K9X2A1)
    const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.random().toString(36).substring(2, 8).toUpperCase();
    const orderNumber = `ORD-${datePrefix}-${randomSuffix}`;

    // 5. Reserve Stock Synchronously with Inventory Service (15-minute TTL hold)
    await inventoryClient.reserveStock(
      orderNumber,
      verifiedItems.map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
      })),
      15,
      user
    );

    // 6. Persist Order, Items, History, and Outbox in an Atomic Transaction
    const fullOrder = await withTransaction(async (client) => {
      const customerEmail = data.customer_email || user.email || 'customer@example.com';
      const customerName = data.customer_name || user.displayName || 'Marketplace Customer';

      // Insert Order Master
      const orderSql = `
        INSERT INTO orders (
          order_number,
          user_id,
          status,
          payment_status,
          currency,
          subtotal,
          shipping_fee,
          tax_amount,
          discount_amount,
          total_amount,
          customer_email,
          customer_name,
          shipping_address,
          billing_address,
          idempotency_key
        ) VALUES ($1, $2, 'PENDING', 'PENDING', $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;

      const orderRes = await client.query(orderSql, [
        orderNumber,
        user.id,
        'USD',
        subtotal,
        shippingFee,
        taxAmount,
        discountAmount,
        totalAmount,
        customerEmail,
        customerName,
        data.shipping_address,
        data.billing_address || null,
        idempotencyKey || null,
      ]);

      const order = orderRes.rows[0];

      // Insert Line Items
      const createdItems = [];
      for (const item of verifiedItems) {
        const itemSql = `
          INSERT INTO order_items (
            order_id,
            seller_id,
            product_id,
            variant_id,
            product_name,
            variant_name,
            sku,
            quantity,
            unit_price,
            line_total,
            currency
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          RETURNING *
        `;

        const itemRes = await client.query(itemSql, [
          order.id,
          item.seller_id || null,
          item.product_id,
          item.variant_id,
          item.product_name,
          item.variant_name,
          item.sku,
          item.quantity,
          item.unit_price,
          item.line_total,
          item.currency,
        ]);
        createdItems.push(itemRes.rows[0]);
      }

      // Record Initial Status History
      await client.query(
        `INSERT INTO order_status_history 
          (order_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, NULL, 'PENDING', 'CUSTOMER', 'Order submitted and stock reserved')`,
        [order.id]
      );

      // Record Transactional Outbox Event
      const outboxPayload = {
        order_id: String(order.id),
        order_number: order.order_number,
        user_id: order.user_id,
        customer_email: order.customer_email,
        customer_name: order.customer_name,
        total_amount: order.total_amount,
        currency: order.currency,
        items: createdItems.map((i) => ({
          variant_id: i.variant_id,
          quantity: i.quantity,
          sku: i.sku,
        })),
      };

      await outboxService.recordEvent(
        client,
        'Order',
        order.id,
        'order.created',
        outboxPayload
      );

      return {
        ...order,
        items: createdItems,
      };
    });

    // 7. Dispatch RabbitMQ Event Asynchronously
    orderPublisher.publishOrderCreated(fullOrder).catch((err) => {
      logger.warn({ err: err.message, orderId: fullOrder.id }, 'Immediate event publish deferred to outbox worker');
    });

    logger.info({ orderNumber: fullOrder.order_number, total: fullOrder.total_amount }, 'Order created successfully');
    return fullOrder;
  },

  /**
   * Get an order by its primary ID with ownership and access validation
   */
  async getOrderById(id, user) {
    const res = await query(
      `SELECT o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'seller_id', oi.seller_id,
              'product_id', oi.product_id,
              'variant_id', oi.variant_id,
              'product_name', oi.product_name,
              'variant_name', oi.variant_name,
              'sku', oi.sku,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'line_total', oi.line_total,
              'currency', oi.currency
            )
          ) FILTER (WHERE oi.id IS NOT NULL), '[]'
        ) AS items,
        COALESCE(
          (
            SELECT json_agg(
              json_build_object(
                'id', osh.id,
                'previous_status', osh.previous_status,
                'new_status', osh.new_status,
                'changed_by', osh.changed_by,
                'reason', osh.reason,
                'created_at', osh.created_at
              ) ORDER BY osh.created_at ASC
            )
            FROM order_status_history osh
            WHERE osh.order_id = o.id
          ), '[]'
        ) AS history
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.id = $1
       GROUP BY o.id`,
      [id]
    );

    if (res.rows.length === 0) {
      throw new AppError('Order not found', 404);
    }

    const order = res.rows[0];
    const isOwner = String(order.user_id) === String(user.id);
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');
    const isSeller = Array.isArray(user.roles) && user.roles.includes('seller') &&
      Array.isArray(order.items) &&
      order.items.some((item) => String(item.seller_id) === String(user.id));

    if (!isOwner && !isAdmin && !isSeller) {
      throw new AppError('Forbidden: You can only view orders that you have placed or received as a seller.', 403);
    }

    return order;
  },

  /**
   * Get an order by human-readable order number
   */
  async getOrderByNumber(orderNumber, user) {
    const res = await query('SELECT id FROM orders WHERE order_number = $1', [orderNumber]);
    if (res.rows.length === 0) {
      throw new AppError(`Order '${orderNumber}' not found`, 404);
    }
    return this.getOrderById(res.rows[0].id, user);
  },

  /**
   * List orders with filtering, pagination, and multi-tenant security
   */
  async listOrders(filters, user) {
    const {
      page = 1,
      limit = 20,
      status,
      payment_status,
      user_id,
      search,
      sort_by = 'created_at',
      sort_order = 'desc',
    } = filters;

    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    const isSeller = Array.isArray(user.roles) && user.roles.includes('seller');
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');
    const wantSellerOrders = (filters.as_seller === 'true' || filters.as_seller === true) && (isSeller || isAdmin);

    // Multi-tenant isolation:
    // 1. Seller view: orders containing items sold by this seller
    if (wantSellerOrders) {
      const targetSellerId = isSeller ? user.id : (filters.seller_id || user.id);
      params.push(targetSellerId);
      conditions.push(`EXISTS (SELECT 1 FROM order_items s_oi WHERE s_oi.order_id = o.id AND s_oi.seller_id = $${params.length})`);
    } else if (!isAdmin) {
      // 2. Regular customer view: customer only sees orders they created
      params.push(user.id);
      conditions.push(`o.user_id = $${params.length}`);
    } else if (user_id) {
      // 3. Admin filtering by user_id
      params.push(user_id);
      conditions.push(`o.user_id = $${params.length}`);
    }

    if (status) {
      params.push(status);
      conditions.push(`o.status = $${params.length}`);
    }

    if (payment_status) {
      params.push(payment_status);
      conditions.push(`o.payment_status = $${params.length}`);
    }

    if (search) {
      params.push(`%${search}%`);
      const idx = `$${params.length}`;
      conditions.push(`(
        o.order_number ILIKE ${idx} OR 
        o.customer_name ILIKE ${idx} OR 
        o.customer_email ILIKE ${idx}
      )`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Total Count
    const countRes = await query(`SELECT COUNT(*)::int AS total FROM orders o ${whereClause}`, params);
    const total = countRes.rows[0]?.total || 0;

    // Data query with item previews
    const validSortCols = ['created_at', 'total_amount', 'status', 'id'];
    const sortCol = validSortCols.includes(sort_by) ? sort_by : 'created_at';
    const sortDir = sort_order.toLowerCase() === 'asc' ? 'ASC' : 'DESC';

    const sql = `
      SELECT o.*,
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
              'seller_id', oi.seller_id,
              'product_id', oi.product_id,
              'variant_id', oi.variant_id,
              'product_name', oi.product_name,
              'variant_name', oi.variant_name,
              'sku', oi.sku,
              'quantity', oi.quantity,
              'unit_price', oi.unit_price,
              'line_total', oi.line_total
            )
          ) FILTER (WHERE oi.id IS NOT NULL), '[]'
        ) AS items
      FROM orders o
      LEFT JOIN order_items oi ON oi.order_id = o.id
      ${whereClause}
      GROUP BY o.id
      ORDER BY o.${sortCol} ${sortDir}
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const dataRes = await query(sql, [...params, limit, offset]);

    return {
      orders: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  },

  /**
   * Process payment confirmation for an order
   */
  async payOrder(id, user, paymentData = {}) {
    const order = await this.getOrderById(id, user);

    if (order.status === 'CANCELLED' || order.status === 'FAILED') {
      throw new AppError(`Cannot process payment for an order with status ${order.status}`, 400);
    }

    if (order.payment_status === 'PAID') {
      return order; // Idempotent success
    }

    const updated = await withTransaction(async (client) => {
      const updateRes = await client.query(
        `UPDATE orders 
         SET payment_status = 'PAID',
             status = 'CONFIRMED',
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      // Record status transition
      await client.query(
        `INSERT INTO order_status_history 
          (order_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, $2, 'CONFIRMED', 'CUSTOMER', $3)`,
        [id, order.status, `Payment settled via ${paymentData.payment_method || 'CARD'}`]
      );

      // Record outbox event
      await outboxService.recordEvent(client, 'Order', id, 'order.paid', {
        order_id: String(id),
        order_number: order.order_number,
        user_id: order.user_id,
        payment_status: 'PAID',
        items: order.items,
      });

      return {
        ...updateRes.rows[0],
        items: order.items,
      };
    });

    // Finalize reservation with Inventory Service
    await inventoryClient.confirmReservation(order.order_number, null, String(order.id));

    // Publish event to RabbitMQ
    orderPublisher.publishOrderPaid(updated).catch(() => {});

    logger.info({ orderNumber: updated.order_number }, 'Order payment finalized');
    return updated;
  },

  /**
   * Cancel order and release reserved inventory
   */
  async cancelOrder(id, user, reason = 'Customer requested cancellation') {
    const order = await this.getOrderById(id, user);

    if (['SHIPPED', 'DELIVERED'].includes(order.status)) {
      throw new AppError(`Cannot cancel an order that is already ${order.status}. Please request a return.`, 400);
    }

    if (order.status === 'CANCELLED') {
      return order; // Idempotent
    }

    const cancelled = await withTransaction(async (client) => {
      const updateRes = await client.query(
        `UPDATE orders 
         SET status = 'CANCELLED',
             cancelled_at = NOW(),
             updated_at = NOW()
         WHERE id = $1
         RETURNING *`,
        [id]
      );

      // Record status history
      await client.query(
        `INSERT INTO order_status_history 
          (order_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, $2, 'CANCELLED', 'CUSTOMER', $3)`,
        [id, order.status, reason]
      );

      // Record outbox event
      await outboxService.recordEvent(client, 'Order', id, 'order.cancelled', {
        order_id: String(id),
        order_number: order.order_number,
        user_id: order.user_id,
        reason,
        items: order.items,
      });

      return {
        ...updateRes.rows[0],
        items: order.items,
      };
    });

    // Release held stock back to available pool in Inventory Service
    await inventoryClient.releaseReservation(
      order.order_number,
      reason,
      order.items?.map((i) => ({ variant_id: i.variant_id, quantity: i.quantity })),
      String(order.id)
    );

    // Publish event
    orderPublisher.publishOrderCancelled(cancelled, reason).catch(() => {});

    logger.info({ orderNumber: cancelled.order_number, reason }, 'Order cancelled and stock released');
    return cancelled;
  },

  /**
   * Update order status (Admin / Seller Fulfillment)
   */
  async updateOrderStatus(id, user, data) {
    const isAdmin = Array.isArray(user.roles) && user.roles.includes('admin');
    const isSeller = Array.isArray(user.roles) && user.roles.includes('seller');
    if (!isAdmin && !isSeller) {
      throw new AppError('Forbidden: Only store administrators or sellers can advance order fulfillment status.', 403);
    }

    const order = await this.getOrderById(id, user);
    const newStatus = data.status;

    if (order.status === newStatus) {
      return order;
    }

    const changer = isAdmin ? 'ADMIN' : 'SELLER';

    const updated = await withTransaction(async (client) => {
      const res = await client.query(
        `UPDATE orders 
         SET status = $1, 
             updated_at = NOW() 
         WHERE id = $2 
         RETURNING *`,
        [newStatus, id]
      );

      await client.query(
        `INSERT INTO order_status_history 
          (order_id, previous_status, new_status, changed_by, reason)
         VALUES ($1, $2, $3, $4, $5)`,
        [id, order.status, newStatus, changer, data.reason || `Status updated to ${newStatus}`]
      );

      await outboxService.recordEvent(client, 'Order', id, 'order.status_updated', {
        order_id: String(id),
        order_number: order.order_number,
        previous_status: order.status,
        new_status: newStatus,
        reason: data.reason,
      });

      return {
        ...res.rows[0],
        items: order.items,
      };
    });

    orderPublisher.publishOrderStatusUpdated(updated, order.status, newStatus, data.reason).catch(() => {});
    return updated;
  },
};

export default orderService;
