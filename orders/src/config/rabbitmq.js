import amqplib from 'amqplib';
import env from './env.js';
import logger from '../utils/logger.js';

class RabbitMQManager {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnecting = false;
    this.reconnectTimeout = null;
    this.subscribers = [];
  }

  get isConnected() {
    return Boolean(this.connection && this.channel);
  }

  async connect() {
    if (this.connection) return;
    if (this.isConnecting) return;

    this.isConnecting = true;

    try {
      logger.info({ url: env.rabbitmq.url.replace(/:[^:@]+@/, ':***@') }, 'Connecting to RabbitMQ broker from order service...');
      this.connection = await amqplib.connect(env.rabbitmq.url);
      this.channel = await this.connection.createChannel();

      // Configure prefetch for fair distribution
      await this.channel.prefetch(env.rabbitmq.prefetch);

      // Declare main topic exchange
      await this.channel.assertExchange(env.rabbitmq.exchange, 'topic', {
        durable: true,
      });

      // Declare service queue and bind to order-relevant events
      await this.channel.assertQueue(env.rabbitmq.orderQueue, {
        durable: true,
      });

      // Bind queue to inventory events for two-way synchronization
      await this.channel.bindQueue(
        env.rabbitmq.orderQueue,
        env.rabbitmq.exchange,
        'inventory.*'
      );

      // Bind queue to payment events for automated order settlement
      await this.channel.bindQueue(
        env.rabbitmq.orderQueue,
        env.rabbitmq.exchange,
        'payment.*'
      );

      this.connection.on('error', (err) => {
        logger.error({ err: err.message }, 'RabbitMQ connection error in order service');
      });

      this.connection.on('close', () => {
        logger.warn('RabbitMQ connection closed. Reconnecting in 5 seconds...');
        this.cleanup();
        this.scheduleReconnect();
      });

      this.channel.on('error', (err) => {
        logger.error({ err: err.message }, 'RabbitMQ channel error in order service');
      });

      this.channel.on('close', () => {
        logger.warn('RabbitMQ channel closed');
      });

      this.isConnecting = false;
      logger.info('RabbitMQ connected and initialized successfully in order service');

      // Resubscribe registered consumers if reconnected
      for (const sub of this.subscribers) {
        await sub();
      }
    } catch (err) {
      this.isConnecting = false;
      this.cleanup();
      logger.error({ err: err.message }, 'Failed to connect to RabbitMQ in order service. Scheduling reconnect in 5s...');
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
      logger.warn({ routingKey }, 'RabbitMQ channel not available for publishing, queueing event locally');
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

      logger.info({ routingKey }, 'Published event to RabbitMQ');
      return published;
    } catch (err) {
      logger.error({ routingKey, err: err.message }, 'Failed to publish event to RabbitMQ');
      return false;
    }
  }

  async subscribe(queueName, onMessage) {
    const subscriber = async () => {
      if (!this.channel) return;

      await this.channel.consume(
        queueName,
        async (msg) => {
          if (!msg) return;

          try {
            const content = JSON.parse(msg.content.toString());
            await onMessage(content, msg);
            this.channel.ack(msg);
          } catch (err) {
            logger.error({ err: err.message }, 'Error processing message from queue');
            // Reject message without requeue if processing permanently failed
            this.channel.nack(msg, false, false);
          }
        },
        { noAck: false }
      );
    };

    this.subscribers.push(subscriber);
    if (this.channel) {
      await subscriber();
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
      logger.info('RabbitMQ connection closed gracefully');
    } catch (err) {
      logger.error({ err: err.message }, 'Error closing RabbitMQ connection');
    } finally {
      this.cleanup();
    }
  }
}

export const rabbitmq = new RabbitMQManager();
export default rabbitmq;
