import env from '../config/env.js';
import { AppError } from '../middleware/errorHandler.js';
import logger from '../utils/logger.js';

export const inventoryClient = {
  /**
   * Synchronously reserve stock for items in the Inventory Microservice
   * @param {string} orderId Human-readable order number or internal ID
   * @param {Array<{ variant_id: number, quantity: number }>} items
   * @param {number} expiresInMinutes TTL for reservation hold (default: 15 mins)
   * @param {object} user Authenticated user context
   * @param {string} token Optional auth JWT
   * @returns {Promise<any>}
   */
  async reserveStock(orderId, items, expiresInMinutes = 15, user = null, token = null) {
    const url = `${env.services.inventoryUrl}/inventory/reserve`;
    const headers = {
      'Content-Type': 'application/json',
      'x-internal-service': 'order-service',
      'x-user-id': user?.id ? String(user.id) : 'system-order-service',
      'x-user-email': user?.email || 'order-service@ecommerce.internal',
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
          order_id: String(orderId),
          items: items.map((i) => ({
            variant_id: Number(i.variant_id),
            quantity: Number(i.quantity),
          })),
          expires_in_minutes: expiresInMinutes,
          idempotency_key: `reserve-${orderId}`,
        }),
      });

      const body = await response.json();

      if (!response.ok) {
        const errorMsg = body.error || body.message || 'Stock reservation failed';
        logger.warn({ orderId, status: response.status, errorMsg }, 'Inventory reservation rejected');
        throw new AppError(errorMsg, response.status >= 500 ? 502 : 400);
      }

      logger.info({ orderId, itemsCount: items.length }, 'Stock successfully reserved in inventory service');
      return body.data?.reservation || body.data || body;
    } catch (err) {
      if (err instanceof AppError) throw err;
      logger.error({ err: err.message, orderId }, 'Error calling inventory reserve endpoint');
      throw new AppError(`Inventory service unavailable: ${err.message}`, 503);
    }
  },

  /**
   * Finalize and confirm a stock reservation upon successful payment
   * @param {string} orderId
   * @param {object} user
   * @param {string} orderNumber
   * @returns {Promise<any>}
   */
  async confirmReservation(orderId, user = null, orderNumber = null) {
    const url = `${env.services.inventoryUrl}/inventory/confirm`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': 'order-service',
          'x-user-id': user?.id ? String(user.id) : 'system-order-service',
          'x-user-email': user?.email || 'order-service@ecommerce.internal',
          'x-user-roles': 'system,admin',
        },
        body: JSON.stringify({
          order_id: String(orderId),
          order_number: orderNumber ? String(orderNumber) : undefined,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        logger.warn({ orderId, status: response.status, body }, 'Inventory confirm call rejected');
      } else {
        logger.info({ orderId }, 'Inventory reservation confirmed permanently');
      }
      return body;
    } catch (err) {
      logger.error({ err: err.message, orderId }, 'Error calling inventory confirm endpoint');
      return null;
    }
  },

  /**
   * Release reserved or confirmed stock back to the available inventory pool (on order cancellation/expiration)
   * @param {string} orderId
   * @param {string} reason
   * @param {Array} items
   * @param {string} orderNumber
   * @returns {Promise<any>}
   */
  async releaseReservation(orderId, reason = 'Order cancelled or expired', items = null, orderNumber = null) {
    const url = `${env.services.inventoryUrl}/inventory/release`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-service': 'order-service',
          'x-user-id': 'system-order-service',
          'x-user-email': 'order-service@ecommerce.internal',
          'x-user-roles': 'system,admin',
        },
        body: JSON.stringify({
          order_id: String(orderId),
          order_number: orderNumber ? String(orderNumber) : undefined,
          reason,
          items: Array.isArray(items) ? items : undefined,
        }),
      });

      const body = await response.json();
      if (!response.ok) {
        logger.warn({ orderId, status: response.status, body }, 'Inventory release call returned non-200');
      } else {
        logger.info({ orderId, reason }, 'Inventory reservation released back to stock pool');
      }
      return body;
    } catch (err) {
      logger.error({ err: err.message, orderId }, 'Error calling inventory release endpoint');
      return null;
    }
  },
};

export default inventoryClient;
