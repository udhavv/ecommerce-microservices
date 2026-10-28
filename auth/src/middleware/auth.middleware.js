import { verifyAccessToken, getExpiryMs } from '../utils/token.js';
import { pool } from '../config/db.js';
import env from '../config/env.js';
import logger from '../utils/logger.js';
import { refreshUserSession } from '../services/auth.service.js';
import { logAuditEvent, AuditEvents } from '../services/audit.service.js';

/**
 * Extract token flexibly from Authorization header or cookies
 */
export function extractToken(req) {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const cleanHeader = authHeader.trim().replace(/^["']|["']$/g, '');
    const match = cleanHeader.match(/^bearer\s+(.+)$/i);
    if (match) {
      return match[1].trim().replace(/^["']|["']$/g, '');
    }
    // Handle raw JWT pasted into Authorization header without "Bearer "
    if (cleanHeader.split('.').length === 3) {
      return cleanHeader;
    }
  }

  // Fallback to cookie
  if (req.cookies?.accessToken) {
    return req.cookies.accessToken.trim().replace(/^["']|["']$/g, '');
  }

  return null;
}

export async function authenticate(req, res, next) {
  const token = extractToken(req);

  if (!token) {
    void logAuditEvent({
      userId: null,
      eventType: AuditEvents.UNAUTHORIZED_ACCESS,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { path: req.path, method: req.method, reason: 'missing_token' },
    });
    return res.status(401).json({
      success: false,
      error: 'Access token is required',
    });
  }

  try {
    const decoded = verifyAccessToken(token);
    const userId = decoded.userId ?? decoded.sub ?? decoded.id;

    if (!userId) {
      void logAuditEvent({
        userId: null,
        eventType: AuditEvents.TOKEN_INVALID,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { path: req.path, method: req.method, reason: 'missing_user_claim' },
      });
      logger.warn({ path: req.path }, 'Token decoded but missing user id or sub claim');
      return res.status(401).json({
        error: 'Invalid access token',
      });
    }

    req.user = {
      ...decoded,
      id: userId,
    };

    return next();
  } catch (error) {
    logger.debug({ err: error.message, name: error.name, path: req.path }, 'Token verification failed');

    if (error.name === 'TokenExpiredError') {
      void logAuditEvent({
        userId: null,
        eventType: AuditEvents.TOKEN_EXPIRED,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { path: req.path, method: req.method, reason: 'token_expired' },
      });

      // Automatic recovery: Check if a refresh token is present in cookies or headers
      const refreshToken = req.cookies?.refreshToken || req.headers['x-refresh-token'];

      if (refreshToken) {
        try {
          const { user, accessToken: newAccessToken, refreshToken: newRefreshToken } =
            await refreshUserSession(refreshToken);

          const isProduction = env.nodeEnv === 'production';
          const cookieBase = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
            path: '/',
          };

          res.cookie('accessToken', newAccessToken, {
            ...cookieBase,
            maxAge: getExpiryMs(env.jwt.accessExpiry, 15 * 60 * 1000),
          });

          res.cookie('refreshToken', newRefreshToken, {
            ...cookieBase,
            maxAge: getExpiryMs(env.jwt.refreshExpiry, 7 * 24 * 60 * 60 * 1000),
          });

          res.setHeader('x-access-token', newAccessToken);

          req.user = {
            ...user,
            id: user.id,
          };

          return next();
        } catch (refreshErr) {
          logger.debug({ err: refreshErr }, 'Automatic token refresh on expired access token failed');
        }
      }

      return res.status(401).json({
        error: 'Access token has expired',
        code: 'TOKEN_EXPIRED',
      });
    }

    void logAuditEvent({
      userId: null,
      eventType: AuditEvents.TOKEN_INVALID,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
      metadata: { path: req.path, method: req.method, reason: error.message },
    });

    return res.status(401).json({
      error: 'Invalid access token',
    });
  }
}

export function authorize(...roles) {
  return async (req, res, next) => {
    if (!req.user?.id) {
      void logAuditEvent({
        userId: null,
        eventType: AuditEvents.UNAUTHORIZED_ACCESS,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
        metadata: { path: req.path, method: req.method, reason: 'unauthenticated' },
      });
      return res.status(401).json({
        error: 'Authentication required',
      });
    }

    if (roles.length === 0) {
      return next();
    }

    try {
      const result = await pool.query(
        `SELECT r.name
         FROM user_roles ur
         JOIN roles r ON r.id = ur.role_id
         WHERE ur.user_id = $1`,
        [req.user.id],
      );

      const userRoles = result.rows.map((row) => row.name);

      req.user.roles = userRoles;

      const hasRequiredRole = roles.some((role) =>
        userRoles.includes(role),
      );

      if (!hasRequiredRole) {
        void logAuditEvent({
          userId: req.user.id,
          eventType: AuditEvents.FORBIDDEN_ACCESS,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
          metadata: { path: req.path, method: req.method, requiredRoles: roles, userRoles },
        });
        return res.status(403).json({
          error: 'Insufficient permissions',
        });
      }

      return next();
    } catch (error) {
      logger.error(
        { err: error, userId: req.user.id },
        'Authorization role lookup failed',
      );

      return next(error);
    }
  };
}
