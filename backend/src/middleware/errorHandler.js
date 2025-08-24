const logger = require('../utils/logger');
const config = require('../config');

// Custom error classes
class AppError extends Error {
  constructor(message, statusCode, code = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message, field = null) {
    super(message, 400, 'VALIDATION_ERROR');
    this.field = field;
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, 'AUTHENTICATION_ERROR');
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, 'AUTHORIZATION_ERROR');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND_ERROR');
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, 'CONFLICT_ERROR');
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RATE_LIMIT_ERROR');
  }
}

// Handle different types of errors
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new ValidationError(message, err.path);
};

const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const value = err.keyValue[field];
  const message = `${field} '${value}' already exists`;
  return new ConflictError(message);
};

const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map(el => el.message);
  const message = `Invalid input data: ${errors.join('. ')}`;
  return new ValidationError(message);
};

const handleJWTError = () => {
  return new AuthenticationError('Invalid token. Please log in again');
};

const handleJWTExpiredError = () => {
  return new AuthenticationError('Your token has expired. Please log in again');
};

const handleSequelizeValidationError = (err) => {
  const errors = err.errors.map(error => ({
    field: error.path,
    message: error.message,
    value: error.value
  }));
  
  const message = errors.map(e => e.message).join('. ');
  return new ValidationError(message);
};

const handleSequelizeUniqueConstraintError = (err) => {
  const field = err.errors[0]?.path || 'field';
  const message = `${field} must be unique`;
  return new ConflictError(message);
};

const handleSequelizeForeignKeyConstraintError = (err) => {
  const message = 'Invalid reference to related resource';
  return new ValidationError(message);
};

// Send error response in development
const sendErrorDev = (err, res) => {
  logger.logError(err, { environment: 'development' });
  
  res.status(err.statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message,
      stack: err.stack,
      details: err.details || null
    },
    data: null
  });
};

// Send error response in production
const sendErrorProd = (err, res) => {
  // Operational, trusted error: send message to client
  if (err.isOperational) {
    logger.logError(err, { environment: 'production', operational: true });
    
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code || 'OPERATIONAL_ERROR',
        message: err.message
      },
      data: null
    });
  } else {
    // Programming or other unknown error: don't leak error details
    logger.logError(err, { environment: 'production', operational: false });
    
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: 'Something went wrong on our end. Please try again later.'
      },
      data: null
    });
  }
};

// Main error handling middleware
const globalErrorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  
  // Log the request information
  logger.logApiRequest(
    req.method,
    req.originalUrl,
    req.user?.id || 'anonymous',
    err.statusCode,
    0
  );

  if (config.nodeEnv === 'development') {
    sendErrorDev(err, res);
  } else {
    let error = { ...err };
    error.message = err.message;

    // Handle specific error types
    if (error.name === 'CastError') error = handleCastErrorDB(error);
    if (error.code === 11000) error = handleDuplicateFieldsDB(error);
    if (error.name === 'ValidationError') error = handleValidationErrorDB(error);
    if (error.name === 'JsonWebTokenError') error = handleJWTError();
    if (error.name === 'TokenExpiredError') error = handleJWTExpiredError();
    if (error.name === 'SequelizeValidationError') error = handleSequelizeValidationError(error);
    if (error.name === 'SequelizeUniqueConstraintError') error = handleSequelizeUniqueConstraintError(error);
    if (error.name === 'SequelizeForeignKeyConstraintError') error = handleSequelizeForeignKeyConstraintError(error);

    sendErrorProd(error, res);
  }
};

// Async error handler wrapper
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = {
  globalErrorHandler,
  catchAsync,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError
};