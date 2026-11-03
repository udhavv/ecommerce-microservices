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

  // Handle Zod validation errors
  if (err.name === 'ZodError') {
    statusCode = 400;
    message = 'Validation failed';
    details = err.errors?.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
  }

  // Handle PostgreSQL unique constraint violations
  if (err.code === '23505') {
    statusCode = 409;
    message = 'A record with these unique details already exists.';
    if (err.detail) details = err.detail;
  }

  // Handle PostgreSQL foreign key violations
  if (err.code === '23503') {
    statusCode = 400;
    message = 'Referenced resource does not exist.';
    if (err.detail) details = err.detail;
  }

  // Handle PostgreSQL invalid data type / syntax
  if (err.code === '22P02') {
    statusCode = 400;
    message = 'Invalid input syntax for data type.';
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
      'Unhandled internal server error in review service'
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

  const response = {
    success: false,
    error: message,
  };

  if (details) {
    response.details = details;
  }

  if (!env.isProduction && statusCode >= 500) {
    response.stack = err.stack;
  }

  return res.status(statusCode).json(response);
}

export default {
  AppError,
  errorHandler,
};
