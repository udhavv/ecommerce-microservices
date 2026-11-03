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
    // Unique violation (e.g. duplicate idempotency_key or order_number)
    statusCode = 409;
    message = 'An order with this identifier or idempotency key already exists.';
    details = err.detail || null;
  } else if (err.code === '23503') {
    // Foreign key violation
    statusCode = 400;
    message = 'Referenced entity could not be found.';
    details = err.detail || null;
  } else if (err.code === '23514') {
    // Check violation
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

  // Log server errors
  if (statusCode >= 500) {
    logger.error(
      {
        err: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        body: req.body,
      },
      'Unhandled exception in order service'
    );
  } else {
    logger.warn(
      {
        statusCode,
        message,
        url: req.originalUrl,
        method: req.method,
      },
      'Operational request failure'
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
