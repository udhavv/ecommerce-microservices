import rabbitmq from '../../config/rabbitmq.js';
import logger from '../../utils/logger.js';

export const paymentPublisher = {
  /**
   * Published when payment is captured
   */
  async publishPaymentSuccessful(payment) {
    const payload = {
      event: 'payment.successful',
      payment_id: String(payment.id),
      payment_reference: payment.payment_reference,
      order_id: String(payment.order_id),
      order_number: payment.order_number,
      user_id: payment.user_id,
      amount: payment.amount,
      currency: payment.currency,
      provider_transaction_id: payment.provider_transaction_id,
      timestamp: new Date().toISOString(),
    };

    logger.info({ paymentReference: payment.payment_reference }, 'Publishing payment.successful event');
    return rabbitmq.publish('payment.successful', payload);
  },

  /**
   * Published when payment fails
   */
  async publishPaymentFailed(payment) {
    const payload = {
      event: 'payment.failed',
      payment_id: String(payment.id),
      payment_reference: payment.payment_reference,
      order_id: String(payment.order_id),
      order_number: payment.order_number,
      user_id: payment.user_id,
      error_code: payment.error_code,
      error_message: payment.error_message,
      timestamp: new Date().toISOString(),
    };

    logger.info({ paymentReference: payment.payment_reference }, 'Publishing payment.failed event');
    return rabbitmq.publish('payment.failed', payload);
  },

  /**
   * Published when payment is refunded
   */
  async publishPaymentRefunded(payment, refund) {
    const payload = {
      event: 'payment.refunded',
      payment_id: String(payment.id),
      payment_reference: payment.payment_reference,
      refund_reference: refund.refund_reference,
      order_id: String(payment.order_id),
      order_number: payment.order_number,
      refunded_amount: refund.amount,
      reason: refund.reason,
      timestamp: new Date().toISOString(),
    };

    logger.info({ refundReference: refund.refund_reference }, 'Publishing payment.refunded event');
    return rabbitmq.publish('payment.refunded', payload);
  },
};

export default paymentPublisher;
