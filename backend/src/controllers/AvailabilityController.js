const { catchAsync, AppError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const AvailabilityService = require('../services/AvailabilityService');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');

class AvailabilityController {
  /**
   * Check availability for a specific treatment and time
   */
  static checkAvailability = catchAsync(async (req, res) => {
    const { storeId, treatmentId, startTime, duration } = req.query;

    if (!storeId || !treatmentId || !startTime) {
      throw new AppError('storeId, treatmentId, and startTime are required', 400, 'MISSING_PARAMETERS');
    }

    const bookingStart = new Date(startTime);
    const treatmentDuration = duration ? parseInt(duration) : null;

    // Get treatment duration if not provided
    let finalDuration = treatmentDuration;
    if (!finalDuration) {
      const treatment = await sequelize.models.Treatment.findByPk(treatmentId);
      if (!treatment) {
        throw new NotFoundError('Treatment');
      }
      finalDuration = treatment.duration;
    }

    const availability = await AvailabilityService.checkAvailability(
      storeId,
      treatmentId,
      bookingStart,
      finalDuration
    );

    if (availability.available) {
      // Get available staff
      const availableStaff = await AvailabilityService.getAvailableStaff(
        storeId,
        treatmentId,
        bookingStart,
        finalDuration
      );

      availability.availableStaff = availableStaff;
    }

    res.json({
      success: true,
      data: {
        ...availability,
        requestedTime: bookingStart.toISOString(),
        duration: finalDuration
      }
    });
  });

  /**
   * Get available slots for a treatment on a specific date
   */
  static getAvailableSlots = catchAsync(async (req, res) => {
    const { storeId, treatmentId, date } = req.query;

    if (!storeId || !treatmentId || !date) {
      throw new AppError('storeId, treatmentId, and date are required', 400, 'MISSING_PARAMETERS');
    }

    // Authorization check for store access
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only access availability for your store');
      }
    }

    const requestedDate = new Date(date);
    const slots = await AvailabilityService.getAvailableSlots(storeId, treatmentId, requestedDate);

    res.json({
      success: true,
      data: {
        date: requestedDate.toISOString().split('T')[0],
        treatmentId,
        storeId,
        availableSlots: slots,
        totalSlots: slots.length
      }
    });
  });

  /**
   * Generate timeslots for a store on a specific date
   */
  static generateTimeslots = catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { date, slotDuration = 60, maxCapacity = 1 } = req.body;

    // Only admins can generate timeslots
    if (req.user.role === config.roles.STORE_ADMIN && req.user.storeId !== storeId) {
      throw new AuthorizationError('You can only generate timeslots for your store');
    }

    if ([config.roles.STAFF, config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to generate timeslots');
    }

    if (!date) {
      throw new AppError('Date is required', 400, 'DATE_REQUIRED');
    }

    const targetDate = new Date(date);
    const slotsGenerated = await AvailabilityService.generateTimeslots(
      storeId,
      targetDate,
      parseInt(slotDuration),
      parseInt(maxCapacity)
    );

    logger.logDatabaseOperation('generate', 'timeslots', null, {
      storeId,
      date: targetDate.toISOString().split('T')[0],
      slotsGenerated,
      generatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        message: `Generated ${slotsGenerated} timeslots for ${targetDate.toISOString().split('T')[0]}`,
        slotsGenerated,
        date: targetDate.toISOString().split('T')[0]
      }
    });
  });

  /**
   * Get availability summary for multiple days
   */
  static getAvailabilitySummary = catchAsync(async (req, res) => {
    const { storeId, startDate, endDate, treatmentId } = req.query;

    if (!storeId || !startDate || !endDate) {
      throw new AppError('storeId, startDate, and endDate are required', 400, 'MISSING_PARAMETERS');
    }

    // Authorization check
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only access availability for your store');
      }
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    // Limit date range to prevent excessive queries
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > 90) {
      throw new AppError('Date range cannot exceed 90 days', 400, 'DATE_RANGE_TOO_LARGE');
    }

    const summary = await AvailabilityService.getAvailabilitySummary(
      storeId,
      start,
      end,
      treatmentId
    );

    res.json({
      success: true,
      data: {
        storeId,
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        treatmentId: treatmentId || null,
        summary
      }
    });
  });

  /**
   * Get available staff for a specific treatment and time
   */
  static getAvailableStaff = catchAsync(async (req, res) => {
    const { storeId, treatmentId, startTime, duration } = req.query;

    if (!storeId || !treatmentId || !startTime) {
      throw new AppError('storeId, treatmentId, and startTime are required', 400, 'MISSING_PARAMETERS');
    }

    // Authorization check
    if ([config.roles.STORE_ADMIN, config.roles.STAFF].includes(req.user.role)) {
      if (req.user.storeId !== storeId) {
        throw new AuthorizationError('You can only access staff availability for your store');
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

    const availableStaff = await AvailabilityService.getAvailableStaff(
      storeId,
      treatmentId,
      bookingStart,
      finalDuration
    );

    res.json({
      success: true,
      data: {
        storeId,
        treatmentId,
        startTime: bookingStart.toISOString(),
        duration: finalDuration,
        availableStaff,
        staffCount: availableStaff.length
      }
    });
  });

  /**
   * Bulk generate timeslots for multiple dates
   */
  static bulkGenerateTimeslots = catchAsync(async (req, res) => {
    const { storeId } = req.params;
    const { startDate, endDate, slotDuration = 60, maxCapacity = 1 } = req.body;

    // Only super admins and store admins can bulk generate
    if (req.user.role === config.roles.STORE_ADMIN && req.user.storeId !== storeId) {
      throw new AuthorizationError('You can only generate timeslots for your store');
    }

    if ([config.roles.STAFF, config.roles.CUSTOMER].includes(req.user.role)) {
      throw new AuthorizationError('Insufficient permissions to generate timeslots');
    }

    if (!startDate || !endDate) {
      throw new AppError('startDate and endDate are required', 400, 'DATES_REQUIRED');
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // Limit to 30 days to prevent excessive operations
    const daysDiff = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    if (daysDiff > 30) {
      throw new AppError('Date range cannot exceed 30 days for bulk generation', 400, 'DATE_RANGE_TOO_LARGE');
    }

    const results = [];
    const currentDate = new Date(start);

    while (currentDate <= end) {
      try {
        const slotsGenerated = await AvailabilityService.generateTimeslots(
          storeId,
          new Date(currentDate),
          parseInt(slotDuration),
          parseInt(maxCapacity)
        );

        results.push({
          date: currentDate.toISOString().split('T')[0],
          slotsGenerated,
          success: true
        });
      } catch (error) {
        results.push({
          date: currentDate.toISOString().split('T')[0],
          slotsGenerated: 0,
          success: false,
          error: error.message
        });
      }

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const totalGenerated = results.reduce((sum, result) => sum + result.slotsGenerated, 0);

    logger.logDatabaseOperation('bulk_generate', 'timeslots', null, {
      storeId,
      dateRange: `${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`,
      totalGenerated,
      generatedBy: req.user.id
    });

    res.json({
      success: true,
      data: {
        message: `Bulk generation completed. Generated ${totalGenerated} total timeslots.`,
        results,
        totalGenerated,
        dateRange: {
          startDate: start.toISOString().split('T')[0],
          endDate: end.toISOString().split('T')[0]
        }
      }
    });
  });
}

module.exports = AvailabilityController;