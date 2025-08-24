const Joi = require('joi');
const { ValidationError } = require('./errorHandler');
const logger = require('../utils/logger');

/**
 * Middleware factory for request validation
 */
const validate = (schema, property = 'body') => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[property], {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const details = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context.value
      }));

      logger.logError(new Error('Validation failed'), {
        context: 'request_validation',
        property,
        details,
        endpoint: req.originalUrl
      });

      const validationError = new ValidationError('Invalid request data');
      validationError.details = details;
      return next(validationError);
    }

    // Replace request property with validated and sanitized data
    req[property] = value;
    next();
  };
};

/**
 * Common validation schemas
 */
const schemas = {
  // UUID validation
  uuid: Joi.string().uuid().required(),
  optionalUuid: Joi.string().uuid().optional(),

  // Pagination
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    sortBy: Joi.string().optional(),
    sortOrder: Joi.string().valid('asc', 'desc').default('asc')
  }),

  // Date range
  dateRange: Joi.object({
    startDate: Joi.date().iso().required(),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).required()
  }),

  // User schemas
  userRegistration: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(128).required(),
    firstName: Joi.string().min(1).max(100).optional(),
    lastName: Joi.string().min(1).max(100).optional(),
    phone: Joi.string().pattern(/^[+]?[1-9]\d{1,14}$/).optional(),
    role: Joi.string().valid('super_admin', 'store_admin', 'staff', 'customer').default('customer'),
    storeId: Joi.string().uuid().optional()
  }),

  userLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),

  userUpdate: Joi.object({
    firstName: Joi.string().min(1).max(100).optional(),
    lastName: Joi.string().min(1).max(100).optional(),
    phone: Joi.string().pattern(/^[+]?[1-9]\d{1,14}$/).optional(),
    isActive: Joi.boolean().optional(),
    metadata: Joi.object().optional()
  }),

  passwordChange: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
  }),

  // Store schemas
  storeCreation: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().optional(),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().optional(),
      postalCode: Joi.string().optional(),
      country: Joi.string().required()
    }).optional(),
    phone: Joi.string().pattern(/^[+]?[1-9]\d{1,14}$/).optional(),
    email: Joi.string().email().optional(),
    website: Joi.string().uri().optional(),
    timezone: Joi.string().required(),
    operatingHours: Joi.object().pattern(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
      Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        closed: Joi.boolean().default(false)
      })
    ).optional(),
    settings: Joi.object().optional(),
    metadata: Joi.object().optional()
  }),

  storeUpdate: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().optional(),
    address: Joi.object({
      street: Joi.string().required(),
      city: Joi.string().required(),
      state: Joi.string().optional(),
      postalCode: Joi.string().optional(),
      country: Joi.string().required()
    }).optional(),
    phone: Joi.string().pattern(/^[+]?[1-9]\d{1,14}$/).optional(),
    email: Joi.string().email().optional(),
    website: Joi.string().uri().optional(),
    timezone: Joi.string().optional(),
    operatingHours: Joi.object().pattern(
      Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'),
      Joi.object({
        open: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        close: Joi.string().pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
        closed: Joi.boolean().default(false)
      })
    ).optional(),
    isActive: Joi.boolean().optional(),
    settings: Joi.object().optional(),
    metadata: Joi.object().optional()
  }),

  // Treatment schemas
  treatmentCreation: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().optional(),
    category: Joi.string().min(1).max(100).optional(),
    duration: Joi.number().integer().min(15).max(480).required(),
    price: Joi.object({
      amount: Joi.number().min(0).required(),
      currency: Joi.string().pattern(/^[A-Z]{3}$/).required()
    }).required(),
    requiredStaffLevel: Joi.string().valid('junior', 'senior', 'expert', 'any').default('any'),
    requiredResources: Joi.array().items(Joi.string().uuid()).default([]),
    maxConcurrentBookings: Joi.number().integer().min(1).max(100).default(1),
    tags: Joi.array().items(Joi.string()).default([]),
    storeId: Joi.string().uuid().required(),
    metadata: Joi.object().optional()
  }),

  treatmentUpdate: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().optional(),
    category: Joi.string().min(1).max(100).optional(),
    duration: Joi.number().integer().min(15).max(480).optional(),
    price: Joi.object({
      amount: Joi.number().min(0).required(),
      currency: Joi.string().pattern(/^[A-Z]{3}$/).required()
    }).optional(),
    requiredStaffLevel: Joi.string().valid('junior', 'senior', 'expert', 'any').optional(),
    requiredResources: Joi.array().items(Joi.string().uuid()).optional(),
    maxConcurrentBookings: Joi.number().integer().min(1).max(100).optional(),
    isActive: Joi.boolean().optional(),
    tags: Joi.array().items(Joi.string()).optional(),
    metadata: Joi.object().optional()
  }),

  // Booking schemas
  bookingCreation: Joi.object({
    customerId: Joi.string().uuid().optional(), // Optional because it can be taken from auth
    storeId: Joi.string().uuid().required(),
    treatmentId: Joi.string().uuid().required(),
    staffId: Joi.string().uuid().optional(),
    bookingDateTime: Joi.date().iso().min('now').required(),
    notes: Joi.string().max(1000).optional()
  }),

  bookingUpdate: Joi.object({
    staffId: Joi.string().uuid().optional(),
    bookingDateTime: Joi.date().iso().min('now').optional(),
    status: Joi.string().valid('pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show').optional(),
    notes: Joi.string().max(1000).optional(),
    cancellationReason: Joi.string().max(500).optional(),
    metadata: Joi.object().optional()
  }),

  // Resource schemas
  resourceCreation: Joi.object({
    name: Joi.string().min(1).max(255).required(),
    description: Joi.string().optional(),
    type: Joi.string().valid('room', 'equipment', 'tool', 'other').required(),
    capacity: Joi.number().integer().min(1).max(100).default(1),
    storeId: Joi.string().uuid().required(),
    specifications: Joi.object().optional(),
    metadata: Joi.object().optional()
  }),

  resourceUpdate: Joi.object({
    name: Joi.string().min(1).max(255).optional(),
    description: Joi.string().optional(),
    type: Joi.string().valid('room', 'equipment', 'tool', 'other').optional(),
    capacity: Joi.number().integer().min(1).max(100).optional(),
    isActive: Joi.boolean().optional(),
    specifications: Joi.object().optional(),
    metadata: Joi.object().optional()
  }),

  // Webhook schemas
  webhookSubscription: Joi.object({
    url: Joi.string().uri().required(),
    events: Joi.array().items(
      Joi.string().valid(
        'booking.created',
        'booking.updated', 
        'booking.cancelled',
        'booking.completed',
        'availability.changed'
      )
    ).min(1).required(),
    maxRetries: Joi.number().integer().min(0).max(10).default(3),
    metadata: Joi.object().optional()
  }),

  webhookUpdate: Joi.object({
    url: Joi.string().uri().optional(),
    events: Joi.array().items(
      Joi.string().valid(
        'booking.created',
        'booking.updated',
        'booking.cancelled', 
        'booking.completed',
        'availability.changed'
      )
    ).min(1).optional(),
    isActive: Joi.boolean().optional(),
    maxRetries: Joi.number().integer().min(0).max(10).optional(),
    metadata: Joi.object().optional()
  })
};

/**
 * Validation middleware for route parameters
 */
const validateParams = validate(schemas.uuid, 'params');

/**
 * Specific validation middleware functions
 */
const validateUserRegistration = validate(schemas.userRegistration);
const validateUserLogin = validate(schemas.userLogin);
const validateUserUpdate = validate(schemas.userUpdate);
const validatePasswordChange = validate(schemas.passwordChange);

const validateStoreCreation = validate(schemas.storeCreation);
const validateStoreUpdate = validate(schemas.storeUpdate);

const validateTreatmentCreation = validate(schemas.treatmentCreation);
const validateTreatmentUpdate = validate(schemas.treatmentUpdate);

const validateBookingCreation = validate(schemas.bookingCreation);
const validateBookingUpdate = validate(schemas.bookingUpdate);

const validateResourceCreation = validate(schemas.resourceCreation);
const validateResourceUpdate = validate(schemas.resourceUpdate);

const validateWebhookSubscription = validate(schemas.webhookSubscription);
const validateWebhookUpdate = validate(schemas.webhookUpdate);

const validatePagination = validate(schemas.pagination, 'query');
const validateDateRange = validate(schemas.dateRange, 'query');

module.exports = {
  validate,
  schemas,
  validateParams,
  validateUserRegistration,
  validateUserLogin,
  validateUserUpdate,
  validatePasswordChange,
  validateStoreCreation,
  validateStoreUpdate,
  validateTreatmentCreation,
  validateTreatmentUpdate,
  validateBookingCreation,
  validateBookingUpdate,
  validateResourceCreation,
  validateResourceUpdate,
  validateWebhookSubscription,
  validateWebhookUpdate,
  validatePagination,
  validateDateRange
};