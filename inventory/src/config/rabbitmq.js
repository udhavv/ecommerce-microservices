import amqp from 'amqplib';
import env from './env.js';
import logger from '../utils/logger.js';

class RabbitMQManager {
  constructor() {
    this.connection = null;
    this.publishChannel = null;
    this.consumerChannel = null;
    this.isConnecting = false;
    this.isConnected = false;
    this.reconnectTimeout = null;
    this.subscribers = []; // List of registered event handlers to re-bind on reconnect
  }

  /**
   * Connect to RabbitMQ with retry logic
   */
  async connect() {
    if (this.isConnected || this.isConnecting) return;
    this.isConnecting = true;

    try {
      logger.info({ url: env.rabbitmq.url }, 'Connecting to RabbitMQ broker...');
      this.connection = await amqp.connect(env.rabbitmq.url);

      this.connection.on('error', (err) => {
        logger.error({ err: err.message }, 'RabbitMQ connection error');
        this.handleDisconnect();
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed');
        this.handleDisconnect();
      });

      // Create publisher channel
      this.publishChannel = await this.connection.createChannel();
      await this.publishChannel.assertExchange(env.rabbitmq.exchange, 'topic', {
        durable: true,
      });

      // Create consumer channel
      this.consumerChannel = await this.connection.createChannel();
      await this.consumerChannel.assertExchange(env.rabbitmq.exchange, 'topic', {
        durable: true,
      });
      await this.consumerChannel.prefetch(env.rabbitmq.prefetch);

      this.isConnected = true;
      this.isConnecting = false;
      logger.info(
        { exchange: env.rabbitmq.exchange },
        'RabbitMQ connected and exchanges asserted successfully'
      );

      // Re-initialize all registered consumers
      for (const sub of this.subscribers) {
        await this._bindSubscriber(sub);
      }
    } catch (error) {
      this.isConnecting = false;
      this.isConnected = false;
      logger.error(
        { err: error.message },
        'Failed to connect to RabbitMQ. Scheduling reconnect in 5s...'
      );
      this.scheduleReconnect(5000);
    }
  }

  scheduleReconnect(delayMs = 5000) {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    this.reconnectTimeout = setTimeout(() => {
      this.connect();
    }, delayMs);
  }

  handleDisconnect() {
    this.isConnected = false;
    this.publishChannel = null;
    this.consumerChannel = null;
    this.scheduleReconnect(5000);
  }

  /**
   * Publish an event to the RabbitMQ topic exchange
   * @param {string} routingKey e.g., 'inventory.low_stock', 'inventory.reserved'
   * @param {object} payload Event data
   * @param {object} options Extra AMQP message properties
   */
  async publishEvent(routingKey, payload, options = {}) {
    if (!this.isConnected || !this.publishChannel) {
      logger.warn(
        { routingKey, payload },
        'RabbitMQ not connected. Skipping message publication or queuing fallback.'
      );
      return false;
    }

    try {
      const messageBuffer = Buffer.from(
        JSON.stringify({
          ...payload,
          timestamp: new Date().toISOString(),
          service: 'inventory-service',
        })
      );

      const published = this.publishChannel.publish(
        env.rabbitmq.exchange,
        routingKey,
        messageBuffer,
        {
          persistent: true,
          contentType: 'application/json',
          ...options,
        }
      );

      logger.info({ routingKey }, 'RabbitMQ event published');
      return published;
    } catch (error) {
      logger.error({ routingKey, err: error.message }, 'Failed to publish RabbitMQ event');
      return false;
    }
  }

  /**
   * Register a subscriber queue with routing keys and consumer handler
   * @param {string} queueName
   * @param {string[]} routingKeys e.g. ['product.created', 'order.placed']
   * @param {Function} handler (data, rawMsg) => Promise<void>
   */
  async registerSubscriber(queueName, routingKeys, handler) {
    const sub = { queueName, routingKeys, handler };
    this.subscribers.push(sub);

    if (this.isConnected && this.consumerChannel) {
      await this._bindSubscriber(sub);
    }
  }

  async _bindSubscriber({ queueName, routingKeys, handler }) {
    try {
      await this.consumerChannel.assertQueue(queueName, {
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours
        },
      });

      for (const key of routingKeys) {
        await this.consumerChannel.bindQueue(queueName, env.rabbitmq.exchange, key);
        logger.info({ queueName, routingKey: key }, 'Bound queue to exchange routing key');
      }

      await this.consumerChannel.consume(queueName, async (msg) => {
        if (!msg) return;

        const routingKey = msg.fields.routingKey;
        try {
          const content = JSON.parse(msg.content.toString());
          logger.info({ routingKey, queueName }, 'Received RabbitMQ message');
          await handler(content, msg);
          this.consumerChannel.ack(msg);
        } catch (err) {
          logger.error(
            { routingKey, err: err.message },
            'Error processing RabbitMQ message. Rejecting/nacking...'
          );
          // Don't requeue if message is malformed to prevent infinite poison pill loop
          this.consumerChannel.nack(msg, false, false);
        }
      });
    } catch (err) {
      logger.error({ queueName, err: err.message }, 'Failed to bind RabbitMQ subscriber');
    }
  }

  async close() {
    if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
    try {
      if (this.publishChannel) await this.publishChannel.close();
      if (this.consumerChannel) await this.consumerChannel.close();
      if (this.connection) await this.connection.close();
      logger.info('RabbitMQ connection closed cleanly');
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing RabbitMQ');
    }
  }
}

export const rabbitmq = new RabbitMQManager();
export default rabbitmq;
