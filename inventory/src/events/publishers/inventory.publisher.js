import rabbitmq from '../../config/rabbitmq.js';
import logger from '../../utils/logger.js';

export const inventoryPublisher = {
  /**
   * Published when inventory changes
   */
  async publishStockUpdated(inventoryItem) {
    await rabbitmq.publishEvent('inventory.stock_updated', {
      inventory_id: inventoryItem.id,
      product_id: inventoryItem.product_id,
      variant_id: inventoryItem.variant_id,
      sku: inventoryItem.sku,
      quantity_available: inventoryItem.quantity_available,
      quantity_reserved: inventoryItem.quantity_reserved,
      low_stock_threshold: inventoryItem.low_stock_threshold,
      seller_id: inventoryItem.seller_id,
    });

    if (inventoryItem.quantity_available <= 0) {
      await this.publishOutOfStock(inventoryItem);
    } else if (inventoryItem.quantity_available <= inventoryItem.low_stock_threshold) {
      await this.publishLowStock(inventoryItem);
    }
  },

  /**
   * Published when an item reaches low stock threshold
   */
  async publishLowStock(inventoryItem) {
    logger.warn(
      { variant_id: inventoryItem.variant_id, available: inventoryItem.quantity_available },
      'Low stock threshold reached'
    );
    await rabbitmq.publishEvent('inventory.low_stock', {
      inventory_id: inventoryItem.id,
      product_id: inventoryItem.product_id,
      variant_id: inventoryItem.variant_id,
      sku: inventoryItem.sku,
      quantity_available: inventoryItem.quantity_available,
      threshold: inventoryItem.low_stock_threshold,
      seller_id: inventoryItem.seller_id,
    });
  },

  /**
   * Published when an item is completely out of stock
   */
  async publishOutOfStock(inventoryItem) {
    logger.warn(
      { variant_id: inventoryItem.variant_id },
      'Variant completely out of stock'
    );
    await rabbitmq.publishEvent('inventory.out_of_stock', {
      inventory_id: inventoryItem.id,
      product_id: inventoryItem.product_id,
      variant_id: inventoryItem.variant_id,
      sku: inventoryItem.sku,
      seller_id: inventoryItem.seller_id,
    });
  },

  /**
   * Published when reservation succeeds
   */
  async publishReservationSuccess(orderId, items) {
    await rabbitmq.publishEvent('inventory.reserved', {
      order_id: orderId,
      items,
      status: 'RESERVED',
    });
  },

  /**
   * Published when reservation fails due to insufficient stock
   */
  async publishReservationFailed(orderId, reason, failedItem) {
    await rabbitmq.publishEvent('inventory.reservation_failed', {
      order_id: orderId,
      reason,
      failed_item: failedItem,
      status: 'FAILED',
    });
  },

  /**
   * Published when reservation is released
   */
  async publishReservationReleased(orderId, reason) {
    await rabbitmq.publishEvent('inventory.released', {
      order_id: orderId,
      reason,
      status: 'RELEASED',
    });
  },

  /**
   * Published when reservation is confirmed as a final sale
   */
  async publishReservationConfirmed(orderId) {
    await rabbitmq.publishEvent('inventory.confirmed', {
      order_id: orderId,
      status: 'CONFIRMED',
    });
  },
};

export default inventoryPublisher;
