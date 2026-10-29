import logger from '../utils/logger.js';
import env from '../config/env.js';

export class AppError extends Error {
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || (err.name === 'AppError' ? 400 : 500);

  if (statusCode >= 500) {
    logger.error(
      {
        err: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
      },
      'Unhandled internal server error',
    );
  } else {
    logger.warn(
      {
        statusCode,
        reason: err.message,
        method: req.method,
        url: req.originalUrl,
      },
      'Request failed with client error',
    );
  }

  // Handle PostgreSQL unique constraint violations (code 23505)
  if (err.code === '23505') {
    return res.status(409).json({
      success: false,
      error: 'Conflict: A record with these unique details already exists.',
      detail: err.detail,
    });
  }

  // Handle foreign key constraint violations (code 23503)
  if (err.code === '23503') {
    return res.status(400).json({
      success: false,
      error: 'Referenced entity not found or constraint violated.',
      detail: err.detail,
    });
  }

  return res.status(statusCode).json({
    success: false,
    error: statusCode === 500 ? 'Internal server error' : err.message,
    ...(env.nodeEnv !== 'production' && statusCode === 500 && { stack: err.stack }),
  });
}

export default errorHandler;
