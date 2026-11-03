import crypto from 'crypto';
import { query } from '../config/db.js';

export const idempotencyService = {
  /**
   * Hashes the request payload
   */
  hashPayload(payload) {
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(payload || {}))
      .digest('hex');
  },

  /**
   * Check if idempotency key exists
   */
  async getRecord(key) {
    if (!key) return null;
    const res = await query(
      `SELECT * FROM inventory_idempotency 
       WHERE idempotency_key = $1 AND (expires_at IS NULL OR expires_at > NOW())`,
      [key]
    );
    return res.rows[0] || null;
  },

  /**
   * Store idempotency record
   */
  async saveRecord(key, payloadHash, status, body, ttlMinutes = 60) {
    if (!key) return null;
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);
    const sql = `
      INSERT INTO inventory_idempotency (idempotency_key, request_hash, response_status, response_body, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (idempotency_key) DO UPDATE
      SET response_status = $3, response_body = $4, expires_at = $5
      RETURNING *
    `;
    const res = await query(sql, [key, payloadHash, status, JSON.stringify(body), expiresAt]);
    return res.rows[0];
  },
};

export default idempotencyService;
