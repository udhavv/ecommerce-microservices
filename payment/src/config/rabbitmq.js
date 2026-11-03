import amqplib from 'amqplib';
import env from './env.js';
import logger from '../utils/logger.js';

class RabbitMQManager {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
    this.reconnectTimeout = null;
  }

  get isConnected() {
    return Boolean(this.connection && this.channel);
  }

  async connect() {
    if (this.connection) return;
    if (this.isConnecting) return;

    this.isConnecting = true;

    try {
      logger.info({ url: env.rabbitmq.url.replace(/:[^:@]+@/, ':***@') }, 'Connecting to RabbitMQ broker from payment service...');
      this.connection = await amqplib.connect(env.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      await this.channel.prefetch(env.rabbitmq.prefetch);

      // Declare main topic exchange
      await this.channel.assertExchange(env.rabbitmq.exchange, 'topic', {
        durable: true,
      });

      this.connection.on('error', (err) => {
        logger.error({ err: err.message }, 'RabbitMQ connection error in payment service');
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed. Reconnecting in 5 seconds...');
        this.cleanup();
        this.scheduleReconnect();
      });

      this.isConnecting = false;
      logger.info('RabbitMQ connected and initialized successfully in payment service');
    } catch (err) {
      this.isConnecting = false;
      this.cleanup();
      logger.error({ err: err.message }, 'Failed to connect to RabbitMQ in payment service. Scheduling reconnect in 5s...');
      this.scheduleReconnect();
    }
  }

  scheduleReconnect() {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }

  cleanup() {
    this.channel = null;
    this.connection = null;
  }

  async publish(routingKey, message, options = {}) {
    if (!this.channel) {
      logger.warn({ routingKey }, 'RabbitMQ channel not available for publishing, event deferred');
      return false;
    }

    try {
      const payload = Buffer.from(JSON.stringify(message));
      const published = this.channel.publish(
        env.rabbitmq.exchange,
        routingKey,
        payload,
        {
          persistent: true,
          timestamp: Date.now(),
          contentType: 'application/json',
          ...options,
        }
      );

      logger.info({ routingKey }, 'Published payment event to RabbitMQ');
      return published;
    } catch (err) {
      logger.error({ routingKey, err: err.message }, 'Failed to publish payment event to RabbitMQ');
      return false;
    }
  }

  async close() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    try {
      if (this.channel) await this.channel.close();
      if (this.connection) await this.connection.close();
      logger.info('RabbitMQ connection closed gracefully in payment service');
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing RabbitMQ connection in payment service');
    } finally {
      this.cleanup();
    }
  }
}

export const rabbitmq = new RabbitMQManager();
export default rabbitmq;
