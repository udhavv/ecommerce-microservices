import rabbitmq from '../../config/rabbitmq.js';
import env from '../../config/env.js';
import logger from '../../utils/logger.js';
import handleInventoryEvent from './inventory.consumer.js';
import handlePaymentEvent from './payment.consumer.js';

export async function initConsumers() {
  if (!rabbitmq.channel) {
    logger.warn('RabbitMQ channel not ready; consumers will bind upon connection');
    return;
  }

  try {
    await rabbitmq.subscribe(env.rabbitmq.orderQueue, async (content, msg) => {
      const routingKey = msg.fields.routingKey || '';

      if (routingKey.startsWith('inventory.')) {
        await handleInventoryEvent(content);
      } else if (routingKey.startsWith('payment.')) {
        await handlePaymentEvent(content);
      }
    });

    logger.info('Order service RabbitMQ consumers registered successfully');
  } catch (err) {
    logger.error({ err: err.message }, 'Failed to initialize order service consumers');
  }
}

export default initConsumers;
