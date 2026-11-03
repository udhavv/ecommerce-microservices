import { query } from '../../config/db.js';
import logger from '../../utils/logger.js';

export async function handleInventoryEvent(content) {
  const { event, order_id, orderId, reason } = content;
  const targetOrderId = order_id || orderId;

  logger.info({ event, orderId: targetOrderId }, 'Processing inventory event in order service');

  if (event === 'inventory.reservation_failed' && targetOrderId) {
    try {
      // Mark order as FAILED due to insufficient inventory
      const res = await query(
        `UPDATE orders 
         SET status = 'FAILED', 
             updated_at = NOW() 
         WHERE (id::text = $1 OR order_number = $1) AND status = 'PENDING'
         RETURNING id`,
        [String(targetOrderId)]
      );

      if (res.rows.length > 0) {
        await query(
          `INSERT INTO order_status_history 
            (order_id, previous_status, new_status, changed_by, reason)
           VALUES ($1, 'PENDING', 'FAILED', 'INVENTORY_SERVICE', $2)`,
          [res.rows[0].id, reason || 'Stock reservation failed in inventory service']
        );
        logger.warn({ orderId: targetOrderId }, 'Order marked as FAILED due to inventory exhaustion');
      }
    } catch (err) {
      logger.error({ err: err.message, orderId: targetOrderId }, 'Error processing inventory reservation failure');
    }
  }
}

export default handleInventoryEvent;
