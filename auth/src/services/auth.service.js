import bcrypt from 'bcrypt';
import crypto from 'node:crypto';

import { pool } from '../config/db.js';
import {
  generateAccessToken,
  generateRefreshToken,
  getRefreshTokenExpiry,
  verifyAccessToken,
} from '../utils/token.js';
import { logAuditEvent, AuditEvents } from './audit.service.js';
import {
  sendVerificationEmail,
  sendPasswordResetEmail,
} from './email.service.js';
import logger from '../utils/logger.js';

const PASSWORD_ROUNDS = 12;

const hashToken = (token) =>
  crypto.createHash('sha256').update(token).digest('hex');

const normalizeEmail = (email) => email.trim().toLowerCase();

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  displayName: user.display_name,
  status: user.status,
  emailVerifiedAt: user.email_verified_at,
  roles: user.roles ?? [],
  createdAt: user.created_at,
});

async function getUserRoles(db, userId) {
  const result = await db.query(
    `SELECT r.name
     FROM roles r
     JOIN user_roles ur ON ur.role_id = r.id
     WHERE ur.user_id = $1
     ORDER BY r.name`,
    [userId],
  );

  return result.rows.map((row) => row.name);
}

async function audit(userId, eventType, metadata = {}) {
  try {
    await logAuditEvent({ userId, eventType, metadata });
  } catch (error) {
    logger.error({ err: error, eventType }, 'Failed to record audit event');
  }
}

function event(name) {
  return AuditEvents?.[name] ?? name;
}

export class AuthError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

/**
 * Register a new user and dispatch verification email
 */
export async function registerUser({
  email,
  password,
  displayName,
}) {
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    typeof displayName !== 'string' ||
    !email.trim() ||
    !displayName.trim() ||
    !password
  ) {
    throw new AuthError('Email, password, and display name are required');
  }

  const normalizedEmail = normalizeEmail(email);
  const name = displayName.trim();

  if (normalizedEmail.length > 254 || name.length > 100) {
    throw new AuthError('Email or display name is too long');
  }

  if (password.length < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new AuthError(
      'Password must be at least 8 characters and no more than 72 UTF-8 bytes',
    );
  }

  const passwordHash = await bcrypt.hash(password, PASSWORD_ROUNDS);
  const client = await pool.connect();

  const rawVerificationToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawVerificationToken);
  const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

  try {
    await client.query('BEGIN');

    const inserted = await client.query(
      `INSERT INTO users (email, password_hash, display_name)
       VALUES ($1, $2, $3)
       RETURNING id, email, display_name, status,
                 email_verified_at, created_at`,
      [normalizedEmail, passwordHash, name],
    );

    const user = inserted.rows[0];

    await client.query(
      `INSERT INTO user_roles (user_id, role_id)
       SELECT $1, id FROM roles WHERE name = 'user'
       ON CONFLICT DO NOTHING`,
      [user.id],
    );

    await client.query(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, verificationExpiry],
    );

    user.roles = await getUserRoles(client, user.id);

    await client.query('COMMIT');

    await audit(user.id, event('USER_REGISTERED'), {
      email: normalizedEmail,
    });

    // Send verification email asynchronously
    try {
      await sendVerificationEmail({
        to: normalizedEmail,
        displayName: name,
        token: rawVerificationToken,
      });
    } catch (emailErr) {
      logger.error({ err: emailErr, userId: user.id }, 'Verification email sending failed');
    }

    return publicUser(user);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve original error
    }

    if (error.code === '23505') {
      throw new AuthError('An account with this email already exists', 409);
    }

    throw error;
  } finally {
    client.release();
  }
}

/**
 * Verify user email via token
 */
export async function verifyUserEmail(rawToken) {
  if (typeof rawToken !== 'string' || !rawToken.trim()) {
    throw new AuthError('Verification token is required', 400);
  }

  const tokenHash = hashToken(rawToken.trim());
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT evt.id, evt.user_id, evt.expires_at, evt.used_at,
              u.email, u.display_name, u.status
       FROM email_verification_tokens evt
       JOIN users u ON u.id = evt.user_id
       WHERE evt.token_hash = $1
       FOR UPDATE OF evt`,
      [tokenHash],
    );

    const record = result.rows[0];

    if (!record) {
      await client.query('ROLLBACK');
      throw new AuthError('Invalid verification token', 400);
    }

    if (record.used_at) {
      await client.query('ROLLBACK');
      throw new AuthError('This verification token has already been used', 400);
    }

    if (new Date(record.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      throw new AuthError('Verification token has expired', 400);
    }

    // Mark token used
    await client.query(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [record.id],
    );

    // Update user status to active and set email_verified_at
    const updated = await client.query(
      `UPDATE users
       SET status = 'active',
           email_verified_at = NOW()
       WHERE id = $1
       RETURNING id, email, display_name, status,
                 email_verified_at, created_at`,
      [record.user_id],
    );

    const user = updated.rows[0];
    user.roles = await getUserRoles(client, user.id);

    await client.query('COMMIT');

    await audit(user.id, event('EMAIL_VERIFIED'), { email: user.email });

    return publicUser(user);
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Initiate forgot password process
 */
export async function forgotPassword(email) {
  if (typeof email !== 'string' || !email.trim()) {
    throw new AuthError('Email is required', 400);
  }

  const normalizedEmail = normalizeEmail(email);

  const result = await pool.query(
    `SELECT id, email, display_name, status
     FROM users
     WHERE email = $1`,
    [normalizedEmail],
  );

  const user = result.rows[0];

  // Prevent email enumeration: return success even if email not found
  if (!user || user.status === 'disabled' || user.status === 'suspended') {
    return {
      message: 'If an account exists with this email, password reset instructions have been sent.',
    };
  }

  const rawToken = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Invalidate old unused reset tokens for this user
    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [user.id],
    );

    await client.query(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.id, tokenHash, expiresAt],
    );

    await client.query('COMMIT');

    await audit(user.id, event('PASSWORD_RESET_REQUESTED'), {
      email: normalizedEmail,
    });

    try {
      await sendPasswordResetEmail({
        to: user.email,
        displayName: user.display_name,
        token: rawToken,
      });
    } catch (emailErr) {
      logger.error({ err: emailErr, userId: user.id }, 'Password reset email sending failed');
    }
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }

  return {
    message: 'If an account exists with this email, password reset instructions have been sent.',
  };
}

/**
 * Reset password using valid reset token
 */
export async function resetPassword({ token: rawToken, newPassword }) {
  if (typeof rawToken !== 'string' || !rawToken.trim()) {
    throw new AuthError('Reset token is required', 400);
  }

  if (typeof newPassword !== 'string' || !newPassword) {
    throw new AuthError('New password is required', 400);
  }

  if (newPassword.length < 8 || Buffer.byteLength(newPassword, 'utf8') > 72) {
    throw new AuthError(
      'Password must be at least 8 characters and no more than 72 UTF-8 bytes',
      400,
    );
  }

  const tokenHash = hashToken(rawToken.trim());
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT prt.id, prt.user_id, prt.expires_at, prt.used_at,
              u.email, u.status
       FROM password_reset_tokens prt
       JOIN users u ON u.id = prt.user_id
       WHERE prt.token_hash = $1
       FOR UPDATE OF prt`,
      [tokenHash],
    );

    const record = result.rows[0];

    if (!record) {
      await client.query('ROLLBACK');
      throw new AuthError('Invalid password reset token', 400);
    }

    if (record.used_at) {
      await client.query('ROLLBACK');
      throw new AuthError('This password reset token has already been used', 400);
    }

    if (new Date(record.expires_at) < new Date()) {
      await client.query('ROLLBACK');
      throw new AuthError('Password reset token has expired', 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, PASSWORD_ROUNDS);

    await client.query(
      `UPDATE users
       SET password_hash = $1
       WHERE id = $2`,
      [passwordHash, record.user_id],
    );

    await client.query(
      `UPDATE password_reset_tokens
       SET used_at = NOW()
       WHERE id = $1`,
      [record.id],
    );

    // Invalidate all active sessions for this user so re-login is required
    await client.query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [record.user_id],
    );

    await client.query('COMMIT');

    await audit(record.user_id, event('PASSWORD_RESET_COMPLETED'), {
      email: record.email,
    });

    return {
      success: true,
      message: 'Password has been reset successfully. Please log in with your new password.',
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw error;
  } finally {
    client.release();
  }
}

export async function loginUser({ email, password }) {
  if (
    typeof email !== 'string' ||
    typeof password !== 'string' ||
    !email.trim() ||
    !password
  ) {
    throw new AuthError('Email and password are required');
  }

  const result = await pool.query(
    `SELECT id, email, password_hash, display_name, status,
            email_verified_at, created_at
     FROM users
     WHERE email = $1`,
    [normalizeEmail(email)],
  );

  const user = result.rows[0];

  // Return a consistent error for unknown emails and wrong passwords.
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    await audit(user?.id ?? null, event('LOGIN_FAILED'), {
      reason: 'invalid_credentials',
    });

    throw new AuthError('Invalid email or password', 401);
  }

  if (!user.email_verified_at || user.status !== 'active') {
    await audit(user.id, event('LOGIN_BLOCKED'), {
      reason: 'account_not_active_or_unverified',
    });

    throw new AuthError('Account is not active or email is not verified', 403);
  }

  const roles = await getUserRoles(pool, user.id);
  const userWithRoles = { ...user, roles };

  const accessToken = generateAccessToken(userWithRoles);
  const refreshToken = generateRefreshToken(userWithRoles);
  const refreshTokenExpiry = getRefreshTokenExpiry();

  await pool.query(
    `INSERT INTO sessions
       (user_id, refresh_token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [user.id, hashToken(refreshToken), refreshTokenExpiry],
  );

  await audit(user.id, event('LOGIN_SUCCESS'));

  return {
    user: publicUser(userWithRoles),
    accessToken,
    refreshToken,
  };
}

export async function refreshUserSession(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    throw new AuthError('Refresh token is required', 401);
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const result = await client.query(
      `SELECT s.id AS session_id, s.user_id,
              u.email, u.display_name, u.status,
              u.email_verified_at, u.created_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()
       FOR UPDATE OF s`,
      [hashToken(refreshToken)],
    );

    const user = result.rows[0];

    if (!user) {
      await client.query('ROLLBACK');
      throw new AuthError('Invalid, expired, or revoked refresh token', 401);
    }

    if (user.status !== 'active' || !user.email_verified_at) {
      await client.query(
        `UPDATE sessions
         SET revoked_at = NOW()
         WHERE id = $1`,
        [user.session_id],
      );
      await client.query('COMMIT');

      throw new AuthError('Account is not active', 403);
    }

    const roles = await getUserRoles(client, user.user_id);
    const userWithRoles = { ...user, id: user.user_id, roles };

    const accessToken = generateAccessToken(userWithRoles);
    const newRefreshToken = generateRefreshToken(userWithRoles);
    const expiry = getRefreshTokenExpiry();

    await client.query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE id = $1`,
      [user.session_id],
    );

    await client.query(
      `INSERT INTO sessions (user_id, refresh_token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [user.user_id, hashToken(newRefreshToken), expiry],
    );

    await client.query('COMMIT');

    await audit(user.user_id, event('TOKEN_REFRESHED'));

    return {
      user: publicUser(userWithRoles),
      accessToken,
      refreshToken: newRefreshToken,
    };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Transaction may already be complete.
    }

    throw error;
  } finally {
    client.release();
  }
}

export async function logoutUser(refreshToken) {
  if (typeof refreshToken !== 'string' || !refreshToken) {
    return;
  }

  const result = await pool.query(
    `UPDATE sessions
     SET revoked_at = NOW()
     WHERE refresh_token_hash = $1
       AND revoked_at IS NULL
     RETURNING user_id`,
    [hashToken(refreshToken)],
  );

  if (result.rows[0]) {
    await audit(result.rows[0].user_id, event('LOGOUT_SUCCESS'));
  }
}

export async function getCurrentUser(userId) {
  const result = await pool.query(
    `SELECT id, email, display_name, status,
            email_verified_at, created_at
     FROM users
     WHERE id = $1`,
    [userId],
  );

  const user = result.rows[0];

  if (!user) {
    throw new AuthError('User not found', 404);
  }

  if (user.status !== 'active' || !user.email_verified_at) {
    throw new AuthError('Account is not verified or inactive', 403);
  }

  user.roles = await getUserRoles(pool, user.id);

  return publicUser(user);
}

export { verifyAccessToken };
