import jwt from 'jsonwebtoken';
import env from '../config/env.js';

export function authenticate(req, res, next) {
  // 1. Try extracting token from HTTP-only cookie (accessToken or access_token)
  let token = req.cookies?.accessToken || req.cookies?.access_token;

  // 2. Fall back to Authorization: Bearer <token> header
  if (!token && req.headers.authorization?.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // 3. Fall back to Gateway forwarded headers or trusted internal microservices
  if (!token && (req.headers['x-user-id'] || req.headers['x-internal-service'])) {
    const internalService = req.headers['x-internal-service'];
    const rolesHeader = req.headers['x-user-roles'] || (internalService ? 'system,admin' : '');
    req.user = {
      id: req.headers['x-user-id'] || (internalService ? 'system-internal' : null),
      email: req.headers['x-user-email'] || (internalService ? `${internalService}@ecommerce.internal` : ''),
      displayName: req.headers['x-user-name'] || internalService || '',
      roles: rolesHeader.split(',').map((r) => r.trim().toLowerCase()).filter(Boolean),
    };
    return next();
  }

  if (!token) {
    req.user = null;
    return next();
  }

  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret);
    req.user = {
      id: decoded.id || decoded.userId || decoded.sub,
      email: decoded.email,
      displayName: decoded.displayName || decoded.name,
      roles: Array.isArray(decoded.roles)
        ? decoded.roles.map((r) => String(r).toLowerCase())
        : [],
    };
    return next();
  } catch (err) {
    req.user = null;
    return next();
  }
}

export function requireAuth(req, res, next) {
  if (!req.user || !req.user.id) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please log in to complete payments.',
    });
  }
  next();
}

export function requireRole(allowedRoles = []) {
  return (req, res, next) => {
    if (!req.user || !req.user.id) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required.',
      });
    }

    const userRoles = req.user.roles || [];
    const hasRole = allowedRoles.some((role) =>
      userRoles.includes(role.toLowerCase())
    );

    if (!hasRole) {
      return res.status(403).json({
        success: false,
        error: `Forbidden: This action requires one of the following roles: [${allowedRoles.join(', ')}]`,
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
