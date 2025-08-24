const { AuthenticationError, AuthorizationError, catchAsync } = require('./errorHandler');
const JWTManager = require('../utils/jwt');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

/**
 * Middleware to authenticate user with JWT token
 */
const authenticate = catchAsync(async (req, res, next) => {
  // Get token from header
  const authHeader = req.headers.authorization;
  const token = JWTManager.extractTokenFromHeader(authHeader);

  if (!token) {
    throw new AuthenticationError('No token provided. Please log in to access this resource.');
  }

  try {
    // Verify the token
    const decoded = JWTManager.verifyAccessToken(token);
    
    // Get user from database
    const { User } = sequelize.models;
    const user = await User.findByPk(decoded.id, {
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      throw new AuthenticationError('The user belonging to this token no longer exists.');
    }

    if (!user.isActive) {
      throw new AuthenticationError('Your account has been deactivated. Please contact support.');
    }

    // Update last login time
    await user.update({ lastLoginAt: new Date() });

    // Add user to request object
    req.user = user;
    req.token = token;

    logger.logAuthEvent('token_verified', user.id, { 
      role: user.role,
      endpoint: req.originalUrl 
    });

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      throw new AuthenticationError('Invalid token. Please log in again.');
    } else if (error.name === 'TokenExpiredError') {
      throw new AuthenticationError('Your token has expired. Please log in again.');
    }
    throw error;
  }
});

/**
 * Middleware to authorize user based on roles
 */
const authorize = (...roles) => {
  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('You must be authenticated to access this resource.');
    }

    if (!roles.includes(req.user.role)) {
      logger.logAuthEvent('authorization_failed', req.user.id, { 
        requiredRoles: roles,
        userRole: req.user.role,
        endpoint: req.originalUrl 
      });
      
      throw new AuthorizationError(`Access denied. Required roles: ${roles.join(', ')}`);
    }

    logger.logAuthEvent('authorization_granted', req.user.id, { 
      requiredRoles: roles,
      userRole: req.user.role,
      endpoint: req.originalUrl 
    });

    next();
  });
};

/**
 * Middleware to check if user can access a specific store
 */
const authorizeStore = (storeIdParam = 'storeId') => {
  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('You must be authenticated to access this resource.');
    }

    const storeId = req.params[storeIdParam] || req.body.storeId || req.query.storeId;

    // Super admins can access any store
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Store admins and staff can only access their assigned store
    if (['store_admin', 'staff'].includes(req.user.role)) {
      if (!req.user.storeId || req.user.storeId !== storeId) {
        logger.logAuthEvent('store_authorization_failed', req.user.id, { 
          userStoreId: req.user.storeId,
          requestedStoreId: storeId,
          endpoint: req.originalUrl 
        });
        
        throw new AuthorizationError('You can only access resources from your assigned store.');
      }
    }

    // Customers can access any store for booking purposes
    // Additional business logic can be added here if needed

    next();
  });
};

/**
 * Middleware to check if user can access their own resources
 */
const authorizeOwner = (userIdParam = 'userId') => {
  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('You must be authenticated to access this resource.');
    }

    const resourceUserId = req.params[userIdParam] || req.body.userId || req.query.userId;

    // Super admins can access any user's resources
    if (req.user.role === 'super_admin') {
      return next();
    }

    // Store admins can access resources of users in their store
    if (req.user.role === 'store_admin' && req.user.storeId) {
      const { User } = sequelize.models;
      const targetUser = await User.findByPk(resourceUserId);
      
      if (targetUser && targetUser.storeId === req.user.storeId) {
        return next();
      }
    }

    // Users can only access their own resources
    if (req.user.id !== resourceUserId) {
      logger.logAuthEvent('owner_authorization_failed', req.user.id, { 
        requestedUserId: resourceUserId,
        endpoint: req.originalUrl 
      });
      
      throw new AuthorizationError('You can only access your own resources.');
    }

    next();
  });
};

/**
 * Middleware to check specific permissions
 */
const checkPermission = (permission, storeIdParam = 'storeId') => {
  return catchAsync(async (req, res, next) => {
    if (!req.user) {
      throw new AuthenticationError('You must be authenticated to access this resource.');
    }

    const storeId = req.params[storeIdParam] || req.body.storeId || req.query.storeId;
    
    if (!req.user.hasPermission(permission, storeId)) {
      logger.logAuthEvent('permission_denied', req.user.id, { 
        permission,
        storeId,
        userRole: req.user.role,
        endpoint: req.originalUrl 
      });
      
      throw new AuthorizationError(`Insufficient permissions. Required: ${permission}`);
    }

    next();
  });
};

/**
 * Optional authentication middleware (doesn't throw error if no token)
 */
const optionalAuth = catchAsync(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = JWTManager.extractTokenFromHeader(authHeader);

  if (token) {
    try {
      const decoded = JWTManager.verifyAccessToken(token);
      
      const { User } = sequelize.models;
      const user = await User.findByPk(decoded.id, {
        attributes: { exclude: ['password'] }
      });

      if (user && user.isActive) {
        req.user = user;
        req.token = token;
      }
    } catch (error) {
      // Silently ignore authentication errors in optional auth
      logger.logAuthEvent('optional_auth_failed', 'anonymous', { 
        error: error.message,
        endpoint: req.originalUrl 
      });
    }
  }

  next();
});

/**
 * Middleware for webhook authentication
 */
const authenticateWebhook = (req, res, next) => {
  const signature = req.headers['x-signature'];
  const timestamp = req.headers['x-timestamp'];
  const body = JSON.stringify(req.body);

  if (!signature || !timestamp) {
    throw new AuthenticationError('Missing webhook signature or timestamp');
  }

  // Check timestamp to prevent replay attacks (allow 5 minutes tolerance)
  const requestTime = parseInt(timestamp);
  const currentTime = Math.floor(Date.now() / 1000);
  const tolerance = 300; // 5 minutes

  if (Math.abs(currentTime - requestTime) > tolerance) {
    throw new AuthenticationError('Request timestamp is too old');
  }

  // The actual signature verification would be done in the webhook handler
  // using the specific webhook's secret
  req.webhookTimestamp = timestamp;
  req.webhookSignature = signature;
  req.webhookBody = body;

  next();
};

module.exports = {
  authenticate,
  authorize,
  authorizeStore,
  authorizeOwner,
  checkPermission,
  optionalAuth,
  authenticateWebhook
};