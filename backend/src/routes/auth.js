const express = require('express');
const bcrypt = require('bcryptjs');
const { catchAsync } = require('../middleware/errorHandler');
const { AuthenticationError, ValidationError } = require('../middleware/errorHandler');
const { authenticate, authorize } = require('../middleware/auth');
const { 
  validateUserLogin, 
  validateUserRegistration, 
  validatePasswordChange 
} = require('../middleware/validation');
const JWTManager = require('../utils/jwt');
const logger = require('../utils/logger');
const { sequelize } = require('../config/database');

const router = express.Router();

/**
 * @swagger
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/User'
 *     responses:
 *       201:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         accessToken:
 *                           type: string
 *                         refreshToken:
 *                           type: string
 *                         tokenType:
 *                           type: string
 *                         expiresIn:
 *                           type: string
 *       400:
 *         description: Validation error
 *       409:
 *         description: Email already exists
 */
router.post('/register', validateUserRegistration, catchAsync(async (req, res) => {
  const { email, password, firstName, lastName, phone, role, storeId } = req.body;

  const { User } = sequelize.models;

  // Check if user already exists
  const existingUser = await User.findOne({ where: { email } });
  if (existingUser) {
    throw new ValidationError('Email already registered', 'email');
  }

  // Validate store assignment for non-customer roles
  if (role && ['store_admin', 'staff'].includes(role) && !storeId) {
    throw new ValidationError('Store assignment required for this role', 'storeId');
  }

  // Create user
  const user = await User.create({
    email,
    password,
    firstName,
    lastName,
    phone,
    role: role || 'customer',
    storeId,
    isActive: true,
    isEmailVerified: false
  });

  // Generate tokens
  const tokens = JWTManager.generateTokenPair(user);

  logger.logAuthEvent('user_registered', user.id, { 
    email: user.email,
    role: user.role,
    storeId: user.storeId 
  });

  res.status(201).json({
    success: true,
    data: {
      user: user.toJSON(),
      tokens
    }
  });
}));

/**
 * @swagger
 * /api/v1/auth/login:
 *   post:
 *     summary: Authenticate user and get tokens
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/User'
 *                     tokens:
 *                       type: object
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', validateUserLogin, catchAsync(async (req, res) => {
  const { email, password } = req.body;

  const { User } = sequelize.models;

  // Find user with password
  const user = await User.findOne({ 
    where: { email },
    attributes: { include: ['password'] }
  });

  if (!user || !(await user.validatePassword(password))) {
    logger.logAuthEvent('login_failed', email, { reason: 'invalid_credentials' });
    throw new AuthenticationError('Invalid email or password');
  }

  if (!user.isActive) {
    logger.logAuthEvent('login_failed', user.id, { reason: 'account_disabled' });
    throw new AuthenticationError('Your account has been deactivated. Please contact support.');
  }

  // Update last login time
  await user.update({ lastLoginAt: new Date() });

  // Generate tokens
  const tokens = JWTManager.generateTokenPair(user);

  logger.logAuthEvent('login_successful', user.id, { 
    email: user.email,
    role: user.role 
  });

  res.json({
    success: true,
    data: {
      user: user.toJSON(),
      tokens
    }
  });
}));

/**
 * @swagger
 * /api/v1/auth/refresh:
 *   post:
 *     summary: Refresh access token
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *       401:
 *         description: Invalid refresh token
 */
router.post('/refresh', catchAsync(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    throw new AuthenticationError('Refresh token is required');
  }

  try {
    // Verify refresh token
    const decoded = JWTManager.verifyRefreshToken(refreshToken);
    
    // Get user from database
    const { User } = sequelize.models;
    const user = await User.findByPk(decoded.id);

    if (!user || !user.isActive) {
      throw new AuthenticationError('Invalid refresh token');
    }

    // Generate new tokens
    const tokens = JWTManager.generateTokenPair(user);

    logger.logAuthEvent('token_refreshed', user.id, { 
      email: user.email 
    });

    res.json({
      success: true,
      data: {
        tokens
      }
    });
  } catch (error) {
    logger.logAuthEvent('token_refresh_failed', 'unknown', { 
      error: error.message 
    });
    throw new AuthenticationError('Invalid refresh token');
  }
}));

/**
 * @swagger
 * /api/v1/auth/logout:
 *   post:
 *     summary: Logout user (invalidate tokens)
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *       401:
 *         description: Unauthorized
 */
router.post('/logout', authenticate, catchAsync(async (req, res) => {
  // In a production system, you would typically:
  // 1. Add the token to a blacklist/revocation list
  // 2. Store blacklisted tokens in Redis with expiration
  // 3. Check blacklist in authentication middleware
  
  logger.logAuthEvent('logout', req.user.id, { 
    email: req.user.email 
  });

  res.json({
    success: true,
    data: {
      message: 'Logged out successfully'
    }
  });
}));

/**
 * @swagger
 * /api/v1/auth/profile:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/User'
 *       401:
 *         description: Unauthorized
 */
router.get('/profile', authenticate, catchAsync(async (req, res) => {
  const { Store } = sequelize.models;
  
  // Get user with store information
  const user = await req.user.reload({
    include: [{
      model: Store,
      as: 'store',
      attributes: ['id', 'name', 'timezone']
    }]
  });

  res.json({
    success: true,
    data: user.toJSON()
  });
}));

/**
 * @swagger
 * /api/v1/auth/change-password:
 *   put:
 *     summary: Change user password
 *     tags: [Authentication]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *               - confirmPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *               newPassword:
 *                 type: string
 *               confirmPassword:
 *                 type: string
 *     responses:
 *       200:
 *         description: Password changed successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Invalid current password
 */
router.put('/change-password', 
  authenticate, 
  validatePasswordChange, 
  catchAsync(async (req, res) => {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const { User } = sequelize.models;
    const user = await User.findByPk(req.user.id, {
      attributes: { include: ['password'] }
    });

    // Verify current password
    if (!(await user.validatePassword(currentPassword))) {
      throw new AuthenticationError('Current password is incorrect');
    }

    // Update password
    await user.update({ password: newPassword });

    logger.logAuthEvent('password_changed', user.id, { 
      email: user.email 
    });

    res.json({
      success: true,
      data: {
        message: 'Password changed successfully'
      }
    });
  })
);

/**
 * @swagger
 * /api/v1/auth/verify-token:
 *   post:
 *     summary: Verify if a token is valid
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token is valid
 *       401:
 *         description: Token is invalid
 */
router.post('/verify-token', catchAsync(async (req, res) => {
  const { token } = req.body;

  if (!token) {
    throw new AuthenticationError('Token is required');
  }

  try {
    const decoded = JWTManager.verifyAccessToken(token);
    const { User } = sequelize.models;
    const user = await User.findByPk(decoded.id);

    if (!user || !user.isActive) {
      throw new AuthenticationError('Token is invalid');
    }

    res.json({
      success: true,
      data: {
        valid: true,
        user: user.toJSON(),
        expiresAt: JWTManager.getTokenExpiration(token)
      }
    });
  } catch (error) {
    throw new AuthenticationError('Token is invalid');
  }
}));

module.exports = router;