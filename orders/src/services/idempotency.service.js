import { query } from '../config/db.js';

export const idempotencyService = {
  /**
   * Find an existing order by idempotency key
   * @param {string} idempotencyKey
   * @returns {Promise<any|null>}
   */
  async findOrderByKey(idempotencyKey) {
    if (!idempotencyKey) return null;

    const res = await query(
      `SELECT o.*, 
        COALESCE(
          json_agg(
            json_build_object(
              'id', oi.id,
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
        ) AS items
       FROM orders o
       LEFT JOIN order_items oi ON oi.order_id = o.id
       WHERE o.idempotency_key = $1
       GROUP BY o.id`,
      [idempotencyKey]
    );

    return res.rows[0] || null;
  },
};

export default idempotencyService;
