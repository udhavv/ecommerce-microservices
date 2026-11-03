import rabbitmq from '../../config/rabbitmq.js';
import logger from '../../utils/logger.js';

export const orderPublisher = {
  /**
   * Published when an order is created and checkout hold is established
   */
  async publishOrderCreated(order) {
    const payload = {
      event: 'order.created',
      order_id: String(order.id),
      order_number: order.order_number,
      user_id: order.user_id,
      customer_email: order.customer_email,
      customer_name: order.customer_name,
      total_amount: order.total_amount,
      currency: order.currency,
      items: (order.items || []).map((i) => ({
        product_id: i.product_id,
        variant_id: i.variant_id,
        quantity: i.quantity,
        sku: i.sku,
        unit_price: i.unit_price,
      })),
      timestamp: new Date().toISOString(),
    };

    logger.info({ orderNumber: order.order_number }, 'Publishing order.created event');
    return rabbitmq.publish('order.created', payload);
  },

  /**
   * Published when an order has been successfully paid / confirmed
   */
  async publishOrderPaid(order) {
    const payload = {
      event: 'order.paid',
      order_id: String(order.id),
      order_number: order.order_number,
      user_id: order.user_id,
      total_amount: order.total_amount,
      payment_status: order.payment_status,
      items: (order.items || []).map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
      })),
      timestamp: new Date().toISOString(),
    };

    logger.info({ orderNumber: order.order_number }, 'Publishing order.paid event');
    return rabbitmq.publish('order.paid', payload);
  },

  /**
   * Published when an order is cancelled
   */
  async publishOrderCancelled(order, reason = '') {
    const payload = {
      event: 'order.cancelled',
      order_id: String(order.id),
      order_number: order.order_number,
      user_id: order.user_id,
      reason,
      items: (order.items || []).map((i) => ({
        variant_id: i.variant_id,
        quantity: i.quantity,
      })),
      timestamp: new Date().toISOString(),
    };

    logger.info({ orderNumber: order.order_number, reason }, 'Publishing order.cancelled event');
    return rabbitmq.publish('order.cancelled', payload);
  },

  /**
   * Published on any order progression status change
   */
  async publishOrderStatusUpdated(order, previousStatus, newStatus, reason = '') {
    const payload = {
      event: 'order.status_updated',
      order_id: String(order.id),
      order_number: order.order_number,
      user_id: order.user_id,
      previous_status: previousStatus,
      new_status: newStatus,
      reason,
      timestamp: new Date().toISOString(),
    };

    return rabbitmq.publish('order.status_updated', payload);
  },
};

export default orderPublisher;
