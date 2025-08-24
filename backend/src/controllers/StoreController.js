const { catchAsync, AppError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');

class StoreController {
  /**
   * Get all stores with pagination and filtering
   */
  static getAllStores = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc', isActive, search } = req.query;
    const { Store, User, Treatment } = sequelize.models;
    
    const where = {};
    
    // Role-based filtering
    if (req.user.role === config.roles.STORE_ADMIN || req.user.role === config.roles.STAFF) {
      where.id = req.user.storeId;
    }
    
    if (isActive !== undefined) where.isActive = isActive === 'true';
    
    if (search) {
      where[sequelize.Sequelize.Op.or] = [
        { name: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } },
        { description: { [sequelize.Sequelize.Op.iLike]: `%${search}%` } }
      ];
    }

    const offset = (page - 1) * limit;
    
    const { count, rows: stores } = await Store.findAndCountAll({
      where,
      include: [
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'role'], required: false },
        { model: Treatment, as: 'treatments', attributes: ['id', 'name'], where: { isActive: true }, required: false }
      ],
      limit: parseInt(limit),
      offset,
      order: [[sortBy, sortOrder.toUpperCase()]]
    });

    const storesWithStats = stores.map(store => {
      const storeData = store.toJSON();
      storeData.staffCount = store.staff ? store.staff.length : 0;
      storeData.treatmentCount = store.treatments ? store.treatments.length : 0;
      storeData.isOpenNow = store.isOpenNow();
      return storeData;
    });

    res.json({
      success: true,
      data: storesWithStats,
      meta: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalCount: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  });

  /**
   * Get store by ID
   */
  static getStoreById = catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { Store, User, Treatment, Resource } = sequelize.models;

    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only access your assigned store');
      }
    }

    const store = await Store.findByPk(storeId, {
      include: [
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email', 'role', 'isActive'] },
        { model: Treatment, as: 'treatments', attributes: ['id', 'name', 'category', 'duration', 'price', 'isActive'] },
        { model: Resource, as: 'resources', attributes: ['id', 'name', 'type', 'capacity', 'isActive'] }
      ]
    });

    if (!store) {
      throw new NotFoundError('Store');
    }

    const storeData = store.toJSON();
    storeData.isOpenNow = store.isOpenNow();
    storeData.formattedAddress = store.getFormattedAddress();

    res.json({ success: true, data: storeData });
  });

  /**
   * Create new store
   */
  static createStore = catchAsync(async (req, res) => {
    const { name, description, address, phone, email, website, timezone, operatingHours, settings, metadata } = req.body;

    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can create stores');
    }

    if (timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: timezone });
      } catch (error) {
        throw new AppError('Invalid timezone', 400, 'INVALID_TIMEZONE');
      }
    }

    const store = await sequelize.models.Store.create({
      name, description, address, phone, email, website,
      timezone: timezone || 'UTC', operatingHours, settings, metadata, isActive: true
    });

    logger.logDatabaseOperation('create', 'stores', store.id, { name: store.name, createdBy: req.user.id });

    res.status(201).json({ success: true, data: store.toJSON() });
  });

  /**
   * Update store
   */
  static updateStore = catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const updates = req.body;

    if (req.user.role === config.roles.STORE_ADMIN && req.user.storeId !== storeId) {
      throw new AuthorizationError('You can only update your assigned store');
    }
    
    if ([config.roles.STAFF, config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to update stores');
    }

    const store = await sequelize.models.Store.findByPk(storeId);
    if (!store) {
      throw new NotFoundError('Store');
    }

    if (updates.timezone) {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: updates.timezone });
      } catch (error) {
        throw new AppError('Invalid timezone', 400, 'INVALID_TIMEZONE');
      }
    }

    await store.update(updates);
    res.json({ success: true, data: store.toJSON() });
  });

  /**
   * Update store operating hours
   */
  static updateOperatingHours = catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { operatingHours } = req.body;

    if (req.user.role === config.roles.STORE_ADMIN && req.user.storeId !== storeId) {
      throw new AuthorizationError('You can only update your assigned store');
    }
    
    if ([config.roles.STAFF, config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to update operating hours');
    }

    const store = await sequelize.models.Store.findByPk(storeId);
    if (!store) {
      throw new NotFoundError('Store');
    }

    await store.update({ operatingHours });

    res.json({
      success: true,
      data: {
        message: 'Operating hours updated successfully',
        operatingHours: store.operatingHours,
        isOpenNow: store.isOpenNow()
      }
    });
  });

  /**
   * Get store availability for a specific date
   */
  static getStoreAvailability = catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { date } = req.query;

    if (!date) {
      throw new AppError('Date parameter is required', 400, 'DATE_REQUIRED');
    }

    const store = await sequelize.models.Store.findByPk(storeId);
    if (!store) {
      throw new NotFoundError('Store');
    }

    const requestedDate = new Date(date);
    const isOpen = store.isOpenOnDate(requestedDate);
    const operatingHours = store.getOperatingHoursForDate(requestedDate);

    let availableSlots = [];
    if (isOpen) {
      availableSlots = await sequelize.models.Timeslot.findAvailableForDate(storeId, requestedDate);
    }

    res.json({
      success: true,
      data: {
        date: requestedDate.toISOString().split('T')[0],
        isOpen,
        operatingHours,
        availableSlots
      }
    });
  });
}

module.exports = StoreController;