require('dotenv').config();

module.exports = {
  // Server Configuration
  port: process.env.PORT || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database Configuration
  database: {
    url: process.env.DATABASE_URL,
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    name: process.env.DB_NAME || 'treatment_booking',
    user: process.env.DB_USER || 'username',
    password: process.env.DB_PASSWORD || 'password'
  },
  
  // JWT Configuration
  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'fallback-refresh-secret',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  // Webhook Configuration
  webhook: {
    secret: process.env.WEBHOOK_SECRET || 'webhook-secret'
  },
  
  // Redis Configuration
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379
  },
  
  // Logging Configuration
  logging: {
    level: process.env.LOG_LEVEL || 'info'
  },
  
  // Email Configuration
  email: {
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT || 587,
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD
  },
  
  // Rate Limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100
  },
  
  // CORS Configuration
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173'
  },
  
  // API Configuration
  api: {
    version: process.env.API_VERSION || 'v1',
    prefix: process.env.API_PREFIX || '/api'
  },
  
  // Booking Configuration
  booking: {
    defaultDuration: 60, // minutes
    maxAdvanceBookingDays: 90,
    cancellationDeadlineHours: 24,
    bufferTimeMinutes: 15
  },
  
  // User Roles
  roles: {
    SUPER_ADMIN: 'super_admin',
    STORE_ADMIN: 'store_admin',
    STAFF: 'staff',
    CUSTOMER: 'customer'
  },
  
  // Booking Statuses
  bookingStatus: {
    PENDING: 'pending',
    CONFIRMED: 'confirmed',
    IN_PROGRESS: 'in_progress',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
    NO_SHOW: 'no_show'
  },
  
  // Webhook Events
  webhookEvents: {
    BOOKING_CREATED: 'booking.created',
    BOOKING_UPDATED: 'booking.updated',
    BOOKING_CANCELLED: 'booking.cancelled',
    BOOKING_COMPLETED: 'booking.completed',
    AVAILABILITY_CHANGED: 'availability.changed'
  }
};