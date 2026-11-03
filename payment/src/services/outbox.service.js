import { v4 as uuidv4 } from 'uuid';
import { query } from '../config/db.js';
import rabbitmq from '../config/rabbitmq.js';
import logger from '../utils/logger.js';

export const outboxService = {
  /**
   * Save an outbox event within an existing database transaction client
   */
  async recordEvent(client, aggregateType, aggregateId, eventType, payload) {
    const eventId = uuidv4();
    const sql = `
      INSERT INTO outbox_events 
        (event_id, aggregate_type, aggregate_id, event_type, payload, next_attempt_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
      RETURNING id, event_id
    `;
    const res = await client.query(sql, [
      eventId,
      aggregateType,
      aggregateId,
      eventType,
      payload,
    ]);
    return res.rows[0];
  },

  /**
   * Process pending outbox events and dispatch to RabbitMQ
   */
  async dispatchPendingEvents() {
    if (!rabbitmq.isConnected) return;

    try {
      const res = await query(
        `SELECT * FROM outbox_events 
         WHERE published_at IS NULL 
           AND next_attempt_at <= NOW() 
           AND attempts < 5 
         ORDER BY id ASC 
         LIMIT 25`
      );

      if (res.rows.length === 0) return;

      for (const event of res.rows) {
        try {
          const published = await rabbitmq.publish(event.event_type, event.payload, {
            messageId: event.event_id,
          });

          if (published) {
            await query(
              `UPDATE outbox_events 
               SET published_at = NOW(), 
                   attempts = attempts + 1, 
                   last_error = NULL 
               WHERE id = $1`,
              [event.id]
            );
          } else {
            throw new Error('Broker rejected publish');
          }
        } catch (err) {
          logger.warn(
            { eventId: event.event_id, err: err.message },
            'Failed to dispatch payment outbox event, scheduling retry'
          );
          await query(
            `UPDATE outbox_events 
             SET attempts = attempts + 1, 
                 next_attempt_at = NOW() + (POWER(2, attempts) * INTERVAL '5 seconds'), 
                 last_error = $1 
             WHERE id = $2`,
            [err.message, event.id]
          );
        }
      }
    } catch (err) {
      logger.error({ err: err.message }, 'Error during payment outbox dispatch');
    }
  },

  startWorker(intervalMs = 4000) {
    const timer = setInterval(() => {
      this.dispatchPendingEvents().catch(() => {});
    }, intervalMs);

    return () => clearInterval(timer);
  },
};

export default outboxService;
