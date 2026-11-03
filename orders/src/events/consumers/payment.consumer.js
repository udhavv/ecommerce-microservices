import { query } from '../../config/db.js';
import logger from '../../utils/logger.js';
import inventoryClient from '../../services/inventory.client.js';

export async function handlePaymentEvent(content) {
  const { event, order_id, orderId, payment_reference } = content;
  const targetOrderId = order_id || orderId;

  logger.info({ event, orderId: targetOrderId, payment_reference }, 'Processing payment event in order service');

  if (event === 'payment.successful' && targetOrderId) {
    try {
      const res = await query(
        `UPDATE orders 
         SET payment_status = 'PAID', 
             status = 'CONFIRMED', 
             updated_at = NOW() 
         WHERE (id::text = $1 OR order_number = $1) AND payment_status != 'PAID'
         RETURNING id, order_number`,
        [String(targetOrderId)]
      );

      if (res.rows.length > 0) {
        const order = res.rows[0];
        await query(
          `INSERT INTO order_status_history 
            (order_id, previous_status, new_status, changed_by, reason)
           VALUES ($1, 'PENDING', 'CONFIRMED', 'PAYMENT_SERVICE', $2)`,
          [order.id, `Payment verified (${payment_reference || 'mock'})`]
        );

        // Confirm inventory reservation
        await inventoryClient.confirmReservation(order.order_number, null, String(order.id));
        logger.info({ orderId: targetOrderId }, 'Order confirmed via payment event');
      }
    } catch (err) {
      logger.error({ err: err.message, orderId: targetOrderId }, 'Error processing payment.successful event');
    }
  }

  if (event === 'payment.failed' && targetOrderId) {
    try {
      const res = await query(
        `SELECT id FROM orders WHERE (id::text = $1 OR order_number = $1)`,
        [String(targetOrderId)]
      );

      if (res.rows.length > 0) {
        await query(
          `INSERT INTO order_status_history 
            (order_id, previous_status, new_status, changed_by, reason)
           VALUES ($1, 'PENDING', 'PENDING', 'PAYMENT_SERVICE', $2)`,
          [res.rows[0].id, `Payment attempt declined (${content.error_code || 'error'})`]
        );
      }
    } catch (err) {
      logger.error({ err: err.message, orderId: targetOrderId }, 'Error logging payment failure history');
    }
  }
}

export default handlePaymentEvent;
