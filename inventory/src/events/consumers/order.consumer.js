import inventoryService from '../../services/inventory.service.js';
import logger from '../../utils/logger.js';

export async function handleOrderEvent(content) {
  const { event, order_id, orderId, order_number, orderNumber, items, reason } = content;
  const primaryOrderId = order_number || orderNumber || order_id || orderId;
  const alternateOrderId = (order_id || orderId) !== primaryOrderId ? (order_id || orderId) : (order_number || orderNumber);
  const finalOrderId = String(primaryOrderId);

  logger.info({ event, orderId: finalOrderId, alternateOrderId }, 'Handling order event in inventory service');

  // Order created / checkout initiated -> Reserve stock if not already reserved
  if (
    event === 'order.created' ||
    event === 'order.placed' ||
    content.type === 'order.created'
  ) {
    // Check if stock was already reserved during synchronous checkout hold
    const isAlreadyReserved = await inventoryService.isOrderReserved(primaryOrderId, alternateOrderId);
    if (isAlreadyReserved) {
      logger.info(
        { orderId: finalOrderId, alternateOrderId },
        'Order stock already reserved via synchronous checkout hold. Skipping duplicate reservation from event'
      );
      return;
    }

    if (Array.isArray(items) && items.length > 0) {
      try {
        await inventoryService.reserveStock(finalOrderId, items, 15, null, alternateOrderId);
      } catch (err) {
        logger.error(
          { orderId: finalOrderId, err: err.message },
          'Failed to reserve stock from order event'
        );
      }
    }
  }

  // Order paid / confirmed -> Finalize stock deduction
  if (
    event === 'order.paid' ||
    event === 'order.confirmed' ||
    content.type === 'order.paid'
  ) {
    try {
      await inventoryService.confirmReservation(finalOrderId, alternateOrderId);
    } catch (err) {
      logger.error(
        { orderId: finalOrderId, err: err.message },
        'Failed to confirm reservation from order event'
      );
    }
  }

  // Order cancelled / payment failed -> Release reserved or confirmed stock
  if (
    event === 'order.cancelled' ||
    event === 'order.failed' ||
    content.type === 'order.cancelled'
  ) {
    try {
      await inventoryService.releaseReservation(
        finalOrderId,
        reason || 'Order cancelled or payment failed',
        items,
        alternateOrderId
      );
    } catch (err) {
      logger.error(
        { orderId: finalOrderId, err: err.message },
        'Failed to release reservation from order event'
      );
    }
  }
}

export default handleOrderEvent;
