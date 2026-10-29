import jwt from 'jsonwebtoken';
import env from '../config/env.js';
import logger from '../utils/logger.js';

/**
 * Extracts authentication credentials flexibly:
 * 1. Kong API Gateway headers (X-User-Id, X-User-Roles, X-User-Email)
 * 2. Authorization Bearer header
 * 3. HTTP-only cookie (accessToken)
 */
export function authenticate(req, res, next) {
  // 1. Gateway Forwarded Headers (Kong / reverse proxy)
  const gatewayUserId = req.headers['x-user-id'];
  if (gatewayUserId) {
    const rolesHeader = req.headers['x-user-roles'] || '';
    let roles = [];
    try {
      roles = rolesHeader.startsWith('[') ? JSON.parse(rolesHeader) : rolesHeader.split(',').map((r) => r.trim()).filter(Boolean);
    } catch {
      roles = rolesHeader.split(',').map((r) => r.trim()).filter(Boolean);
    }

    req.user = {
      id: gatewayUserId,
      email: req.headers['x-user-email'] || '',
      roles,
    };
    return next();
  }

  // 2. Direct Bearer token in Authorization header
  let token = null;
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const match = authHeader.match(/^bearer\s+(.+)$/i);
    if (match) {
      token = match[1].trim();
    } else if (authHeader.split('.').length === 3) {
      token = authHeader.trim();
    }
  }

  // 3. Cookie fallback
  if (!token && req.cookies?.accessToken) {
    token = req.cookies.accessToken;
  }

  if (!token) {
    // Unauthenticated (guest)
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    const userId = decoded.userId ?? decoded.sub ?? decoded.id;

    if (!userId) {
      req.user = null;
      return next();
    }

    req.user = {
      ...decoded,
      id: userId,
      roles: Array.isArray(decoded.roles) ? decoded.roles : [],
    };
    return next();
  } catch (error) {
    logger.debug({ err: error.message }, 'JWT verification failed in product service');
    req.user = null;
    return next();
  }
}

/**
 * Middleware ensuring user is logged in
 */
export function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please sign in to continue.',
    });
  }
  next();
}

/**
 * Middleware enforcing specific user roles
 * @param {string[]} allowedRoles Array of allowed roles (e.g. ['seller', 'admin'])
 */
export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required. Please sign in to continue.',
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) => userRoles.includes(role));

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: This action requires one of the following roles: [${allowedRoles.join(', ')}].`,
      });
    }

    next();
  };
}

export default {
  authenticate,
  requireAuth,
  requireRole,
};
