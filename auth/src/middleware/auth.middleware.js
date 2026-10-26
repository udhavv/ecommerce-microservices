
import { verifyAccessToken } from '../utils/token.js';
import { pool } from '../config/db.js';
import logger from '../utils/logger.js';

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  // Prefer an explicitly supplied Bearer token; otherwise use the cookie.
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7).trim()
    : req.cookies?.accessToken;

  if (!token) {
    return res.status(401).json({
      error: 'Access token is required',
    });
  }

  try {
    const decoded = verifyAccessToken(token);

    const userId = decoded.sub ?? decoded.id;

    if (!userId) {
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
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: 'Access token has expired',
      });
    }

    return res.status(401).json({
      error: 'Invalid access token',
    });
  }
}

export function authorize(...roles) {
  return async (req, res, next) => {
    if (!req.user?.id) {
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
