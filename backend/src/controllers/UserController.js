const { catchAsync, AppError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');

class UserController {
  /**
   * Get all users with pagination and filtering
   */
  static getAllUsers = catchAsync(async (req, res) => {
    const { 
      page = 1, 
      limit = 10, 
      sortBy = 'createdAt', 
      sortOrder = 'desc',
      role,
      storeId,
      isActive,
      search 
    } = req.query;

    const { User, Store } = sequelize.models;
    
    // Build where clause
    const where = {};
    
    // Role-based filtering
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      // Store admins can only see users from their store
      if (req.user.role === config.roles.STORE_ADMIN) {
        where.storeId = req.user.storeId;
      } else {
        // Staff and customers can only see themselves
        where.id = req.user.id;
      }
    }
    
    // Additional filters
    if (role) where.role = role;
    if (storeId && req.user.role === config.roles.SUPER_ADMIN) where.storeId = storeId;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    // Search functionality
    if (search) {
      where[sequelize.Sequelize.Op.or] = [
        { firstName: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { lastName: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { email: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;
    
    const { count, rows: users } = await User.findAndCountAll({
      where,
      include: [{
        model: Store,
        as: 'store',
        attributes: ['id', 'name']
      }],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]],
      attributes: { exclude: ['password'] }
    });

    const totalPages = Math.ceil(count / limit);

    logger.logDatabaseOperation('select', 'users', null, { 
      count,
      filters: where,
      requestedBy: req.user.id 
    });

    res.json({
      success: true,
      data: users,
      meta: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalCount: count,
        totalPages
      }
    });
  });

  /**
   * Get user by ID
   */
  static getUserById = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { User, Store } = sequelize.models;

    const user = await User.findByPk(userId, {
      include: [{
        model: Store,
        as: 'store',
        attributes: ['id', 'name', 'timezone']
      }],
      attributes: { exclude: ['password'] }
    });

    if (!user) {
      throw new NotFoundError('User');
    }

    // Authorization check
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      if (req.user.role === config.roles.STORE_ADMIN) {
        if (user.storeId !== req.user.storeId) {
          throw new AuthorizationError('You can only access users from your store');
        }
      } else if (req.user.id !== userId) {
        throw new AuthorizationError('You can only access your own profile');
      }
    }

    logger.logDatabaseOperation('select', 'users', userId, { 
      requestedBy: req.user.id 
    });

    res.json({
      success: true,
      data: user
    });
  });

  /**
   * Create new user
   */
  static createUser = catchAsync(async (req, res) => {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      phone, 
      role, 
      storeId,
      isActive = true 
    } = req.body;

    const { User, Store } = sequelize.models;

    // Authorization check
    if (req.user.role !== config.roles.SUPER_ADMIN && req.user.role !== config.roles.STORE_ADMIN) {
      throw new AuthorizationError('Insufficient permissions to create users');
    }

    // Store admins can only create users for their store
    let finalStoreId = storeId;
    if (req.user.role === config.roles.STORE_ADMIN) {
      finalStoreId = req.user.storeId;
      
      // Store admins cannot create super admins or other store admins
      if (role && [config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN].includes(role)) {
        throw new AuthorizationError('Insufficient permissions to create this user role');
      }
    }

    // Validate email uniqueness
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new AppError('Email already exists', 400, 'EMAIL_EXISTS');
    }

    // Validate store exists if provided
    if (finalStoreId) {
      const store = await Store.findByPk(finalStoreId);
      if (!store) {
        throw new NotFoundError('Store');
      }
    }

    // Create user
    const user = await User.create({
      email,
      password,
      firstName,
      lastName,
      phone,
      role: role || config.roles.CUSTOMER,
      storeId: finalStoreId,
      isActive,
      isEmailVerified: false
    });

    logger.logDatabaseOperation('create', 'users', user.id, { 
      email: user.email,
      role: user.role,
      createdBy: req.user.id 
    });

    res.status(201).json({
      success: true,
      data: user.toJSON()
    });
  });

  /**
   * Update user
   */
  static updateUser = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const updates = req.body;
    const { User, Store } = sequelize.models;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Authorization check
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      if (req.user.role === config.roles.STORE_ADMIN) {
        // Store admins can only update users from their store
        if (user.storeId !== req.user.storeId) {
          throw new AuthorizationError('You can only update users from your store');
        }
        
        // Store admins cannot update role or storeId
        if (updates.role || updates.storeId) {
          throw new AuthorizationError('Insufficient permissions to update role or store assignment');
        }
      } else if (req.user.id !== userId) {
        throw new AuthorizationError('You can only update your own profile');
      }
    }

    // Validate store exists if being updated
    if (updates.storeId) {
      const store = await Store.findByPk(updates.storeId);
      if (!store) {
        throw new NotFoundError('Store');
      }
    }

    // Remove password from updates (use separate endpoint)
    delete updates.password;

    // Update user
    await user.update(updates);

    logger.logDatabaseOperation('update', 'users', userId, { 
      updates,
      updatedBy: req.user.id 
    });

    res.json({
      success: true,
      data: user.toJSON()
    });
  });

  /**
   * Delete user (soft delete)
   */
  static deleteUser = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { User } = sequelize.models;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Authorization check
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      if (req.user.role === config.roles.STORE_ADMIN) {
        if (user.storeId !== req.user.storeId) {
          throw new AuthorizationError('You can only delete users from your store');
        }
      } else {
        throw new AuthorizationError('Insufficient permissions to delete users');
      }
    }

    // Prevent self-deletion
    if (req.user.id === userId) {
      throw new AppError('You cannot delete your own account', 400, 'SELF_DELETE_NOT_ALLOWED');
    }

    // Soft delete by deactivating
    await user.update({ isActive: false });

    logger.logDatabaseOperation('delete', 'users', userId, { 
      deletedBy: req.user.id 
    });

    res.json({
      success: true,
      data: {
        message: 'User deactivated successfully'
      }
    });
  });

  /**
   * Activate/Deactivate user
   */
  static toggleUserStatus = catchAsync(async (req, res) => {
    const { userId } = req.params;
    const { isActive } = req.body;
    const { User } = sequelize.models;

    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('User');
    }

    // Authorization check
    if (req.user.role !== config.roles.SUPER_ADMIN && req.user.role !== config.roles.STORE_ADMIN) {
      throw new AuthorizationError('Insufficient permissions to change user status');
    }

    if (req.user.role === config.roles.STORE_ADMIN && user.storeId !== req.user.storeId) {
      throw new AuthorizationError('You can only modify users from your store');
    }

    // Prevent self-deactivation
    if (req.user.id === userId && isActive === false) {
      throw new AppError('You cannot deactivate your own account', 400, 'SELF_DEACTIVATE_NOT_ALLOWED');
    }

    await user.update({ isActive });

    logger.logDatabaseOperation('update', 'users', userId, { 
      statusChange: { isActive },
      updatedBy: req.user.id 
    });

    res.json({
      success: true,
      data: {
        message: `User ${isActive ? 'activated' : 'deactivated'} successfully`,
        user: user.toJSON()
      }
    });
  });

  /**
   * Get user statistics
   */
  static getUserStats = catchAsync(async (req, res) => {
    const { User, Booking } = sequelize.models;

    // Only super admins and store admins can view stats
    if (![config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to view user statistics');
    }

    const whereClause = {};
    if (req.user.role === config.roles.STORE_ADMIN) {
      whereClause.storeId = req.user.storeId;
    }

    const [
      totalUsers,
      activeUsers,
      usersByRole,
      recentUsers
    ] = await Promise.all([
      // Total users
      User.count({ where: whereClause }),
      
      // Active users
      User.count({ where: { ...whereClause, isActive: true } }),
      
      // Users by role
      User.findAll({
        where: whereClause,
        attributes: [
          'role',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['role'],
        raw: true
      }),
      
      // Recently registered users (last 30 days)
      User.count({
        where: {
          ...whereClause,
          createdAt: {
            [sequelize.Sequelize.Op.gte]: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          }
        }
      })
    ]);

    // Format role statistics
    const roleStats = {};
    usersByRole.forEach(item => {
      roleStats[item.role] = parseInt(item.count);
    });

    res.json({
      success: true,
      data: {
        totalUsers,
        activeUsers,
        inactiveUsers: totalUsers - activeUsers,
        recentUsers,
        roleDistribution: roleStats
      }
    });
  });
}

module.exports = UserController;