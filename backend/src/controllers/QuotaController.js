const { catchAsync, AppError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const QuotaService = require('../services/QuotaService');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');

class QuotaController {
  /**
   * Check booking quota for a specific request
   */
  static checkBookingQuota = catchAsync(async (req, res) => {
    const { storeId, treatmentId, staffId, startTime, duration } = req.query;

    if (!storeId || !treatmentId || !startTime) {
      throw new AppError('storeId, treatmentId, and startTime are required', 400, 'MISSING_PARAMETERS');
    }

    // Authorization check
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only check quotas for your store');
      }
    }

    const bookingStart = new Date(startTime);
    
    // Get treatment duration if not provided
    let finalDuration = duration ? parseInt(duration) : null;
    if (!finalDuration) {
      const treatment = await sequelize.models.Treatment.findByPk(treatmentId);
      if (!treatment) {
        throw new NotFoundError('Treatment');
      }
      finalDuration = treatment.duration;
    }

    const quotaCheck = await QuotaService.checkBookingQuota(
      storeId,
      treatmentId,
      staffId,
      bookingStart,
      finalDuration
    );

    res.json({
      success: true,
      data: {
        ...quotaCheck,
        requestedTime: bookingStart.toISOString(),
        duration: finalDuration,
        storeId,
        treatmentId,
        staffId: staffId || null
      }
    });
  });

  /**
   * Get quota utilization for a store on a specific date
   */
  static getQuotaUtilization = catchAsync(async (req, res) => {
    const { storeId, date } = req.query;

    if (!storeId || !date) {
      throw new AppError('storeId and date are required', 400, 'MISSING_PARAMETERS');
    }

    // Authorization check
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only view utilization for your store');
      }
    }

    if (req.user.role === config.roles.CUSTOMER) {
      throw new AuthorizationError('Insufficient permissions to view quota utilization');
    }

    const requestedDate = new Date(date);
    const utilization = await QuotaService.getQuotaUtilization(storeId, requestedDate);

    res.json({
      success: true,
      data: utilization
    });
  });

  /**
   * Get peak hours analysis for a store
   */
  static getPeakHoursAnalysis = catchAsync(async (req, res) => {
    const { storeId, startDate, endDate } = req.query;

    if (!storeId || !startDate || !endDate) {
      throw new AppError('storeId, startDate, and endDate are required', 400, 'MISSING_PARAMETERS');
    }

    // Authorization check
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only view analysis for your store');
      }
    }

    if (req.user.role === config.roles.CUSTOMER) {
      throw new AuthorizationError('Insufficient permissions to view peak hours analysis');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Limit analysis to 90 days
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      throw new AppError('Date range cannot exceed 90 days', 400, 'DATE_RANGE_TOO_LARGE');
    }

    const analysis = await QuotaService.getPeakHoursAnalysis(storeId, start, end);

    res.json({
      success: true,
      data: analysis
    });
  });

  /**
   * Update store quota settings
   */
  static updateQuotaSettings = catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { maxDailyBookings, maxConcurrentBookings, bufferTimeMinutes } = req.body;

    // Authorization check
    if (req.user.role === config.roles.STORE_ADMIN && req.user.storeId !== storeId) {
      throw new AuthorizationError('You can only update settings for your store');
    }

    if ([config.roles.STAFF, config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to update quota settings');
    }

    const store = await sequelize.models.Store.findByPk(storeId);
    if (!store) {
      throw new NotFoundError('Store');
    }

    const currentSettings = store.settings || {};
    const newSettings = {
      ...currentSettings,
      ...(maxDailyBookings !== undefined && { maxDailyBookings: parseInt(maxDailyBookings) }),
      ...(maxConcurrentBookings !== undefined && { maxConcurrentBookings: parseInt(maxConcurrentBookings) }),
      ...(bufferTimeMinutes !== undefined && { bufferTimeMinutes: parseInt(bufferTimeMinutes) })
    };

    await store.update({ settings: newSettings });

    logger.logDatabaseOperation('update', 'stores', storeId, {
      quotaSettingsUpdate: true,
      newSettings,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        message: 'Quota settings updated successfully',
        settings: newSettings
      }
    });
  });

  /**
   * Get store quota settings
   */
  static getQuotaSettings = catchAsync(async (req, res) => {
    const { storeId } = req.params;

    // Authorization check
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only view settings for your store');
      }
    }

    const store = await sequelize.models.Store.findByPk(storeId);
    if (!store) {
      throw new NotFoundError('Store');
    }

    const settings = store.settings || {};
    const quotaSettings = {
      maxDailyBookings: settings.maxDailyBookings || null,
      maxConcurrentBookings: settings.maxConcurrentBookings || null,
      bufferTimeMinutes: settings.bufferTimeMinutes || 15,
      allowOnlineBooking: settings.allowOnlineBooking !== false,
      requireApproval: settings.requireApproval || false
    };

    res.json({
      success: true,
      data: {
        storeId,
        storeName: store.name,
        quotaSettings
      }
    });
  });

  /**
   * Get capacity forecast for upcoming days
   */
  static getCapacityForecast = catchAsync(async (req, res) => {
    const { storeId, days = 7 } = req.query;

    if (!storeId) {
      throw new AppError('storeId is required', 400, 'MISSING_PARAMETERS');
    }

    // Authorization check
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only view forecast for your store');
      }
    }

    if (req.user.role === config.roles.CUSTOMER) {
      throw new AuthorizationError('Insufficient permissions to view capacity forecast');
    }

    const forecastDays = Math.min(parseInt(days), 30); // Limit to 30 days
    const forecast = [];
    const currentDate = new Date();

    for (let i = 0; i < forecastDays; i++) {
      const date = new Date(currentDate);
      date.setDate(date.getDate() + i);
      
      try {
        const utilization = await QuotaService.getQuotaUtilization(storeId, date);
        forecast.push(utilization);
      } catch (error) {
        forecast.push({
          date: date.toISOString().split('T')[0],
          storeId,
          daily: { totalBookings: 0, maxBookings: 0, utilization: 0 },
          treatments: [],
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      data: {
        storeId,
        forecastDays,
        forecast
      }
    });
  });
}

module.exports = QuotaController;