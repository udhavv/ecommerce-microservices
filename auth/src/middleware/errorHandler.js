import logger from '../utils/logger.js';
import env from '../config/env.js';

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;

  logger.error(
    {
      err,
      method: req.method,
      url: req.originalUrl,
      ip: req.ip,
    },
    'Request error',
  );

  res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : err.message,
    ...(env.nodeEnv !== 'production' && { stack: err.stack }),
  });
}
