import logger from '../utils/logger.js';
import env from '../config/env.js';

export class AppError extends Error {
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.details = details;

    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(err, req, res, _next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  let details = err.details || null;

  // PostgreSQL Error Code Mappings
  if (err.code === '23505') {
    // Unique violation
    statusCode = 409;
    message = 'A payment with this reference or idempotency key already exists.';
    details = err.detail || null;
  } else if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced entity could not be found.';
    details = err.detail || null;
  } else if (err.code === '23514') {
    statusCode = 400;
    message = 'Data check constraint violated.';
    details = err.detail || null;
  } else if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation error';
    details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  if (statusCode >= 500) {
    logger.error(
      {
        err: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
      },
      'Unhandled exception in payment service'
    );
  } else {
    logger.warn(
      {
        statusCode,
        message,
        url: req.originalUrl,
        method: req.method,
      },
      'Operational request failure in payment service'
    );
  }

  return res.status(statusCode).json({
    success: false,
    error: message,
    ...(details && { details }),
    ...(!env.isProduction && statusCode >= 500 && { stack: err.stack }),
  });
}

export default errorHandler;
