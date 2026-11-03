import env from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const orderClient = {
  /**
   * Fetch order from Order Service
   * @param {number|string} orderId
   * @param {string} [token]
   * @returns {Promise<any>}
   */
  async getOrder(orderId, token = null) {
    const url = `${env.services.orderUrl}/orders/${orderId}`;
    const headers = {
      'Content-Type': 'application/json',
      'x-internal-service': 'payment-service',
      'x-user-id': 'system-payment-service',
      'x-user-email': 'payment-service@ecommerce.internal',
      'x-user-roles': 'system,admin',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, { headers });
      const body = await response.json();

      if (!response.ok) {
        if (response.status === 404) {
          throw new AppError(`Order #${orderId} not found in order service`, 404);
        }
        throw new AppError(body.error || 'Failed to fetch order', response.status);
      }

      return body.data?.order || body.data || body;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err.message, orderId }, 'Error contacting order service');
      throw new AppError(`Order service unavailable: ${err.message}`, 503);
    }
  },

  /**
   * Notify Order Service that payment has completed successfully
   * @param {number|string} orderId
   * @param {object} paymentData
   * @param {string} [token]
   * @returns {Promise<any>}
   */
  async markOrderAsPaid(orderId, paymentData, token = null) {
    const url = `${env.services.orderUrl}/orders/${orderId}/pay`;
    const headers = {
      'Content-Type': 'application/json',
      'x-internal-service': 'payment-service',
      'x-user-id': 'system-payment-service',
      'x-user-email': 'payment-service@ecommerce.internal',
      'x-user-roles': 'system,admin',
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          payment_method: paymentData.payment_method || 'MOCK_CARD',
          transaction_id: paymentData.provider_transaction_id,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        logger.warn({ orderId, status: response.status, body }, 'Order service pay endpoint returned non-200');
      } else {
        logger.info({ orderId }, 'Order service successfully updated to PAID / CONFIRMED');
      }
      return body;
    } catch (err) {
      logger.error({ err: err.message, orderId }, 'Failed to notify order service of payment completion');
      return null;
    }
  },
};

export default orderClient;
