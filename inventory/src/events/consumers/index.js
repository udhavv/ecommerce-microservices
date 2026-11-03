import rabbitmq from '../../config/rabbitmq.js';
import env from '../../config/env.js';
import handleProductEvent from './product.consumer.js';
import handleOrderEvent from './order.consumer.js';
import logger from '../../utils/logger.js';

export async function initConsumers() {
  try {
    // 1. Subscribe to Product Events
    await rabbitmq.registerSubscriber(
      `${env.rabbitmq.inventoryQueue}_products`,
      ['product.created', 'product.deleted', 'product.#'],
      handleProductEvent
    );

    // 2. Subscribe to Order Events
    await rabbitmq.registerSubscriber(
      `${env.rabbitmq.inventoryQueue}_orders`,
      ['order.created', 'order.placed', 'order.paid', 'order.confirmed', 'order.cancelled', 'order.failed'],
      handleOrderEvent
    );

    logger.info('Inventory RabbitMQ event consumers registered successfully');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to initialize inventory consumers');
  }
}

export default initConsumers;
