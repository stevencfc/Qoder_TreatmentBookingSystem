const winston = require('winston');
const config = require('../config');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'white'
};

// Add colors to winston
winston.addColors(colors);

// Define log format
const format = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss:ms' }),
  winston.format.errors({ stack: true }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message} ${info.stack || ''}`
  )
);

// Define which transports the logger must use
const transports = [
  // Console transport
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      format
    )
  }),
  
  // File transport for errors
  new winston.transports.File({
    filename: 'logs/error.log',
    level: 'error',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  }),
  
  // File transport for all logs
  new winston.transports.File({
    filename: 'logs/combined.log',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      winston.format.json()
    )
  })
];

// Create the logger
const logger = winston.createLogger({
  level: config.logging.level,
  levels,
  format,
  transports,
  exitOnError: false
});

// Ensure logs directory exists
const fs = require('fs');
const path = require('path');
const logsDir = path.join(process.cwd(), 'logs');

if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Create a stream object with a 'write' function for Morgan HTTP logging
logger.stream = {
  write: (message) => {
    logger.http(message.trim());
  }
};

// Helper methods for structured logging
logger.logBookingEvent = (action, bookingId, userId, details = {}) => {
  logger.info('Booking event', {
    action,
    bookingId,
    userId,
    ...details,
    timestamp: new Date().toISOString()
  });
};

logger.logAuthEvent = (action, userId, details = {}) => {
  logger.info('Authentication event', {
    action,
    userId,
    ...details,
    timestamp: new Date().toISOString()
  });
};

logger.logWebhookEvent = (action, webhookId, eventType, details = {}) => {
  logger.info('Webhook event', {
    action,
    webhookId,
    eventType,
    ...details,
    timestamp: new Date().toISOString()
  });
};

logger.logApiRequest = (method, url, userId, statusCode, responseTime) => {
  logger.http('API request', {
    method,
    url,
    userId,
    statusCode,
    responseTime: `${responseTime}ms`,
    timestamp: new Date().toISOString()
  });
};

logger.logError = (error, context = {}) => {
  logger.error('Application error', {
    message: error.message,
    stack: error.stack,
    ...context,
    timestamp: new Date().toISOString()
  });
};

logger.logDatabaseOperation = (operation, table, recordId, details = {}) => {
  logger.debug('Database operation', {
    operation,
    table,
    recordId,
    ...details,
    timestamp: new Date().toISOString()
  });
};

module.exports = logger;