
import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

/**
 * Logs a security-relevant event to the security_audit_events table.
 * Audit logging should never crash the authentication request.
 */
export async function logAuditEvent({
  userId = null,
  eventType,
  ipAddress,
  userAgent,
  metadata = {},
}) {
  try {
    await pool.query(
      `INSERT INTO security_audit_events
         (user_id, event_type, metadata)
       VALUES ($1, $2, $3::jsonb)`,
      [
        userId,
        eventType,
        JSON.stringify({
          ...metadata,
          ...(ipAddress ? { ipAddress } : {}),
          ...(userAgent ? { userAgent } : {}),
        }),
      ],
    );
  } catch (error) {
    // Audit failures must not crash the authentication request.
    // Never log passwords or raw authentication tokens.
    logger.error(
      {
        error: error.message,
        eventType,
        userId,
      },
      'Failed to write security audit event',
    );
  }
}

/**
 * Standard security audit event types.
 */
export const AuditEvents = {
  USER_REGISTERED: 'user.registered',
  LOGIN_SUCCESS: 'user.login.success',
  LOGIN_FAILED: 'user.login.failed',
  LOGIN_BLOCKED: 'user.login.blocked',
  TOKEN_REFRESHED: 'user.token.refreshed',
  LOGOUT: 'user.logout',
  PASSWORD_CHANGED: 'user.password.changed',
  EMAIL_VERIFIED: 'user.email.verified',
  PASSWORD_RESET_REQUESTED: 'user.password.reset.requested',
  PASSWORD_RESET_COMPLETED: 'user.password.reset.completed',
};
