const { catchAsync, AppError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');

class TreatmentController {
  /**
   * Get all treatments with filtering
   */
  static getAllTreatments = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'name', sortOrder = 'asc', storeId, category, isActive, search } = req.query;
    const { Treatment, Store, Resource } = sequelize.models;
    
    const where = {};
    
    // Role-based filtering
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      where.storeId = req.user.storeId;
    } else if (storeId) {
      where.storeId = storeId;
    }
    
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    if (search) {
      where[sequelize.Sequelize.Op.or] = [
        { name: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { description: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;
    
    const { count, rows: treatments } = await Treatment.findAndCountAll({
      where,
      include: [
        { model: Store, as: 'store', attributes: ['id', 'name'] },
        { model: Resource, as: 'resources', attributes: ['id', 'name', 'type'], through: { attributes: [] } }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]]
    });

    const treatmentsWithStats = treatments.map(treatment => {
      const treatmentData = treatment.toJSON();
      treatmentData.formattedPrice = treatment.getFormattedPrice();
      treatmentData.formattedDuration = treatment.getDurationFormatted();
      return treatmentData;
    });

    res.json({
      success: true,
      data: treatmentsWithStats,
      meta: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalCount: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  });

  /**
   * Get treatment by ID
   */
  static getTreatmentById = catchAsync(async (req, res) => {
    const { treatmentId } = req.params;
    const { Treatment, Store, Resource, Booking } = sequelize.models;

    const treatment = await Treatment.findByPk(treatmentId, {
      include: [
        { model: Store, as: 'store', attributes: ['id', 'name', 'timezone'] },
        { model: Resource, as: 'resources', attributes: ['id', 'name', 'type', 'capacity'], through: { attributes: [] } }
      ]
    });

    if (!treatment) {
      throw new NotFoundError('Treatment');
    }

    // Authorization check for store-level access
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (treatment.storeId !== req.user.storeId) {
        throw new AuthorizationError('You can only access treatments from your store');
      }
    }

    const treatmentData = treatment.toJSON();
    treatmentData.formattedPrice = treatment.getFormattedPrice();
    treatmentData.formattedDuration = treatment.getDurationFormatted();

    // Get booking statistics for this treatment (last 30 days)
    if (req.user.role !== config.roles.CUSTOMER) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const bookingStats = await Booking.findAll({
        where: {
          treatmentId,
          createdAt: { [sequelize.Sequelize.Op.gte]: thirtyDaysAgo }
        },
        attributes: [
          'status',
          [sequelize.fn('COUNT', sequelize.col('id')), 'count']
        ],
        group: ['status'],
        raw: true
      });

      treatmentData.recentBookingStats = {};
      bookingStats.forEach(stat => {
        treatmentData.recentBookingStats[stat.status] = parseInt(stat.count);
      });
    }

    res.json({ success: true, data: treatmentData });
  });

  /**
   * Create new treatment
   */
  static createTreatment = catchAsync(async (req, res) => {
    const { name, description, category, duration, price, requiredStaffLevel, requiredResources, maxConcurrentBookings, tags, storeId, metadata } = req.body;

    // Authorization check
    if (req.user.role === config.roles.STORE_ADMIN && req.user.storeId !== storeId) {
      throw new AuthorizationError('You can only create treatments for your store');
    }
    
    if ([config.roles.STAFF, config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to create treatments');
    }

    // Validate store exists
    const store = await sequelize.models.Store.findByPk(storeId);
    if (!store) {
      throw new NotFoundError('Store');
    }

    // Validate required resources exist
    if (requiredResources && requiredResources.length > 0) {
      const resources = await sequelize.models.Resource.findAll({
        where: {
          id: { [sequelize.Sequelize.Op.in]: requiredResources },
          storeId
        }
      });
      
      if (resources.length !== requiredResources.length) {
        throw new AppError('Some required resources do not exist or do not belong to this store', 400, 'INVALID_RESOURCES');
      }
    }

    const treatment = await sequelize.models.Treatment.create({
      name, description, category, duration, price, requiredStaffLevel, 
      requiredResources: requiredResources || [], maxConcurrentBookings, 
      tags: tags || [], storeId, metadata, isActive: true
    });

    // Associate with resources if specified
    if (requiredResources && requiredResources.length > 0) {
      await treatment.setResources(requiredResources);
    }

    logger.logDatabaseOperation('create', 'treatments', treatment.id, { name: treatment.name, storeId, createdBy: req.user.id });

    res.status(201).json({ success: true, data: treatment.toJSON() });
  });

  /**
   * Update treatment
   */
  static updateTreatment = catchAsync(async (req, res) => {
    const { treatmentId } = req.params;
    const updates = req.body;

    const treatment = await sequelize.models.Treatment.findByPk(treatmentId);
    if (!treatment) {
      throw new NotFoundError('Treatment');
    }

    // Authorization check
    if (req.user.role === config.roles.STORE_ADMIN && treatment.storeId !== req.user.storeId) {
      throw new AuthorizationError('You can only update treatments from your store');
    }
    
    if ([config.roles.STAFF, config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to update treatments');
    }

    // Validate required resources if being updated
    if (updates.requiredResources) {
      const resources = await sequelize.models.Resource.findAll({
        where: {
          id: { [sequelize.Sequelize.Op.in]: updates.requiredResources },
          storeId: treatment.storeId
        }
      });
      
      if (resources.length !== updates.requiredResources.length) {
        throw new AppError('Some required resources do not exist or do not belong to this store', 400, 'INVALID_RESOURCES');
      }
    }

    await treatment.update(updates);

    // Update resource associations if specified
    if (updates.requiredResources) {
      await treatment.setResources(updates.requiredResources);
    }

    logger.logDatabaseOperation('update', 'treatments', treatmentId, { updates, updatedBy: req.user.id });

    res.json({ success: true, data: treatment.toJSON() });
  });

  /**
   * Delete treatment (soft delete)
   */
  static deleteTreatment = catchAsync(async (req, res) => {
    const { treatmentId } = req.params;

    const treatment = await sequelize.models.Treatment.findByPk(treatmentId);
    if (!treatment) {
      throw new NotFoundError('Treatment');
    }

    // Authorization check
    if (req.user.role === config.roles.STORE_ADMIN && treatment.storeId !== req.user.storeId) {
      throw new AuthorizationError('You can only delete treatments from your store');
    }
    
    if ([config.roles.STAFF, config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to delete treatments');
    }

    // Check for active bookings
    const activeBookings = await sequelize.models.Booking.count({
      where: {
        treatmentId,
        status: { [sequelize.Sequelize.Op.in]: ['pending', 'confirmed'] },
        bookingDateTime: { [sequelize.Sequelize.Op.gte]: new Date() }
      }
    });

    if (activeBookings > 0) {
      throw new AppError('Cannot delete treatment with active bookings', 400, 'ACTIVE_BOOKINGS_EXIST');
    }

    // Soft delete by deactivating
    await treatment.update({ isActive: false });

    logger.logDatabaseOperation('delete', 'treatments', treatmentId, { deletedBy: req.user.id });

    res.json({ success: true, data: { message: 'Treatment deactivated successfully' } });
  });

  /**
   * Get treatment categories
   */
  static getTreatmentCategories = catchAsync(async (req, res) => {
    const { storeId } = req.query;
    
    const where = { isActive: true };
    if (storeId) where.storeId = storeId;
    if (req.user.role === config.roles.STORE_ADMIN) where.storeId = req.user.storeId;

    const categories = await sequelize.models.Treatment.findAll({
      where,
      attributes: [
        'category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'treatmentCount']
      ],
      group: ['category'],
      having: sequelize.where(sequelize.col('category'), sequelize.Op.ne, null),
      order: [['category', 'ASC']],
      raw: true
    });

    res.json({
      success: true,
      data: categories.map(cat => ({
        category: cat.category,
        treatmentCount: parseInt(cat.treatmentCount)
      }))
    });
  });
}

module.exports = TreatmentController;