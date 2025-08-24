const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');

class QuotaService {
  /**
   * Check if a booking can be created based on various quota constraints
   */
  static async checkBookingQuota(storeId, treatmentId, staffId, startTime, duration) {
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    const quotaChecks = {
      treatmentConcurrency: await this.checkTreatmentConcurrency(treatmentId, startTime, endTime),
      staffAvailability: staffId ? await this.checkStaffAvailability(staffId, startTime, endTime) : { available: true },
      resourceAvailability: await this.checkResourceAvailability(treatmentId, startTime, endTime),
      dailyLimit: await this.checkDailyBookingLimit(storeId, startTime),
      storeCapacity: await this.checkStoreCapacity(storeId, startTime, endTime)
    };

    const isAvailable = Object.values(quotaChecks).every(check => check.available);
    
    return {
      available: isAvailable,
      checks: quotaChecks,
      conflicts: Object.entries(quotaChecks)
        .filter(([_, check]) => !check.available)
        .map(([type, check]) => ({ type, reason: check.reason }))
    };
  }

  /**
   * Check treatment concurrent booking limits
   */
  static async checkTreatmentConcurrency(treatmentId, startTime, endTime) {
    const { Treatment, Booking } = sequelize.models;
    
    const treatment = await Treatment.findByPk(treatmentId);
    if (!treatment) {
      return { available: false, reason: 'Treatment not found' };
    }

    const concurrentBookings = await Booking.count({
      where: {
        treatmentId,
        status: {
          [sequelize.Sequelize.Op.notIn]: [config.bookingStatus.CANCELLED, config.bookingStatus.NO_SHOW]
        },
        [sequelize.Sequelize.Op.or]: [
          {
            bookingDateTime: {
              [sequelize.Sequelize.Op.between]: [startTime, endTime]
            }
          },
          {
            [sequelize.Sequelize.Op.and]: [
              {
                bookingDateTime: {
                  [sequelize.Sequelize.Op.lt]: startTime
                }
              },
              sequelize.Sequelize.literal(`booking_date_time + INTERVAL '1 minute' * duration > '${startTime.toISOString()}'`)
            ]
          }
        ]
      }
    });

    const available = concurrentBookings < treatment.maxConcurrentBookings;
    
    return {
      available,
      current: concurrentBookings,
      maximum: treatment.maxConcurrentBookings,
      reason: available ? null : `Maximum ${treatment.maxConcurrentBookings} concurrent bookings for this treatment`
    };
  }

  /**
   * Check staff availability for the time slot
   */
  static async checkStaffAvailability(staffId, startTime, endTime) {
    const { Booking, User } = sequelize.models;
    
    const staff = await User.findByPk(staffId);
    if (!staff || !staff.isActive) {
      return { available: false, reason: 'Staff member not found or inactive' };
    }

    const conflictingBookings = await Booking.count({
      where: {
        staffId,
        status: {
          [sequelize.Sequelize.Op.notIn]: [config.bookingStatus.CANCELLED, config.bookingStatus.NO_SHOW]
        },
        [sequelize.Sequelize.Op.or]: [
          {
            bookingDateTime: {
              [sequelize.Sequelize.Op.between]: [startTime, endTime]
            }
          },
          {
            [sequelize.Sequelize.Op.and]: [
              {
                bookingDateTime: {
                  [sequelize.Sequelize.Op.lt]: startTime
                }
              },
              sequelize.Sequelize.literal(`booking_date_time + INTERVAL '1 minute' * duration > '${startTime.toISOString()}'`)
            ]
          }
        ]
      }
    });

    return {
      available: conflictingBookings === 0,
      conflicts: conflictingBookings,
      reason: conflictingBookings > 0 ? 'Staff member has conflicting bookings' : null
    };
  }

  /**
   * Check resource availability for the treatment
   */
  static async checkResourceAvailability(treatmentId, startTime, endTime) {
    const { Treatment, Resource } = sequelize.models;
    
    const treatment = await Treatment.findByPk(treatmentId, {
      include: [{ model: Resource, as: 'resources' }]
    });

    if (!treatment || !treatment.resources || treatment.resources.length === 0) {
      return { available: true, reason: null };
    }

    for (const resource of treatment.resources) {
      const isAvailable = await resource.isAvailable(startTime, endTime);
      if (!isAvailable) {
        return {
          available: false,
          resource: resource.name,
          reason: `Resource ${resource.name} is not available`
        };
      }
    }

    return { available: true, resources: treatment.resources.length };
  }

  /**
   * Check daily booking limits for the store
   */
  static async checkDailyBookingLimit(storeId, startTime) {
    const { Store, Booking } = sequelize.models;
    
    const store = await Store.findByPk(storeId);
    if (!store) {
      return { available: false, reason: 'Store not found' };
    }

    const dailyLimit = store.settings?.maxDailyBookings || null;
    if (!dailyLimit) {
      return { available: true, reason: 'No daily limit set' };
    }

    const startOfDay = new Date(startTime);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startTime);
    endOfDay.setHours(23, 59, 59, 999);

    const dailyBookings = await Booking.count({
      where: {
        storeId,
        bookingDateTime: {
          [sequelize.Sequelize.Op.between]: [startOfDay, endOfDay]
        },
        status: {
          [sequelize.Sequelize.Op.notIn]: [config.bookingStatus.CANCELLED, config.bookingStatus.NO_SHOW]
        }
      }
    });

    return {
      available: dailyBookings < dailyLimit,
      current: dailyBookings,
      maximum: dailyLimit,
      reason: dailyBookings >= dailyLimit ? `Daily booking limit of ${dailyLimit} reached` : null
    };
  }

  /**
   * Check overall store capacity for the time slot
   */
  static async checkStoreCapacity(storeId, startTime, endTime) {
    const { Store, Booking } = sequelize.models;
    
    const store = await Store.findByPk(storeId);
    if (!store) {
      return { available: false, reason: 'Store not found' };
    }

    const maxCapacity = store.settings?.maxConcurrentBookings || null;
    if (!maxCapacity) {
      return { available: true, reason: 'No capacity limit set' };
    }

    const concurrentBookings = await Booking.count({
      where: {
        storeId,
        status: {
          [sequelize.Sequelize.Op.notIn]: [config.bookingStatus.CANCELLED, config.bookingStatus.NO_SHOW]
        },
        [sequelize.Sequelize.Op.or]: [
          {
            bookingDateTime: {
              [sequelize.Sequelize.Op.between]: [startTime, endTime]
            }
          },
          {
            [sequelize.Sequelize.Op.and]: [
              {
                bookingDateTime: {
                  [sequelize.Sequelize.Op.lt]: startTime
                }
              },
              sequelize.Sequelize.literal(`booking_date_time + INTERVAL '1 minute' * duration > '${startTime.toISOString()}'`)
            ]
          }
        ]
      }
    });

    return {
      available: concurrentBookings < maxCapacity,
      current: concurrentBookings,
      maximum: maxCapacity,
      reason: concurrentBookings >= maxCapacity ? `Store capacity limit of ${maxCapacity} reached` : null
    };
  }

  /**
   * Get quota utilization for a store on a specific date
   */
  static async getQuotaUtilization(storeId, date) {
    const { Store, Booking, Treatment } = sequelize.models;
    
    const store = await Store.findByPk(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get daily bookings
    const dailyBookings = await Booking.findAll({
      where: {
        storeId,
        bookingDateTime: {
          [sequelize.Sequelize.Op.between]: [startOfDay, endOfDay]
        },
        status: {
          [sequelize.Sequelize.Op.notIn]: [config.bookingStatus.CANCELLED, config.bookingStatus.NO_SHOW]
        }
      },
      include: [{ model: Treatment, as: 'treatment', attributes: ['name', 'maxConcurrentBookings'] }]
    });

    // Calculate utilization metrics
    const totalBookings = dailyBookings.length;
    const maxDailyBookings = store.settings?.maxDailyBookings || 0;
    const dailyUtilization = maxDailyBookings > 0 ? (totalBookings / maxDailyBookings) * 100 : 0;

    // Treatment-specific utilization
    const treatmentUtilization = {};
    dailyBookings.forEach(booking => {
      const treatmentId = booking.treatmentId;
      const treatmentName = booking.treatment?.name || 'Unknown';
      const maxConcurrent = booking.treatment?.maxConcurrentBookings || 1;
      
      if (!treatmentUtilization[treatmentId]) {
        treatmentUtilization[treatmentId] = {
          name: treatmentName,
          bookings: 0,
          maxConcurrent,
          utilization: 0
        };
      }
      
      treatmentUtilization[treatmentId].bookings++;
      treatmentUtilization[treatmentId].utilization = 
        (treatmentUtilization[treatmentId].bookings / maxConcurrent) * 100;
    });

    return {
      date: date.toISOString().split('T')[0],
      storeId,
      daily: {
        totalBookings,
        maxBookings: maxDailyBookings,
        utilization: Math.round(dailyUtilization)
      },
      treatments: Object.values(treatmentUtilization)
    };
  }

  /**
   * Get peak hours analysis for a store
   */
  static async getPeakHoursAnalysis(storeId, startDate, endDate) {
    const { Booking } = sequelize.models;
    
    const bookings = await Booking.findAll({
      where: {
        storeId,
        bookingDateTime: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        },
        status: {
          [sequelize.Sequelize.Op.notIn]: [config.bookingStatus.CANCELLED, config.bookingStatus.NO_SHOW]
        }
      },
      attributes: ['bookingDateTime'],
      raw: true
    });

    const hourlyDistribution = {};
    const dailyDistribution = {};

    bookings.forEach(booking => {
      const bookingTime = new Date(booking.bookingDateTime);
      const hour = bookingTime.getHours();
      const dayOfWeek = bookingTime.toLocaleDateString('en-US', { weekday: 'long' });

      // Hourly distribution
      if (!hourlyDistribution[hour]) {
        hourlyDistribution[hour] = 0;
      }
      hourlyDistribution[hour]++;

      // Daily distribution
      if (!dailyDistribution[dayOfWeek]) {
        dailyDistribution[dayOfWeek] = 0;
      }
      dailyDistribution[dayOfWeek]++;
    });

    // Find peak hours and days
    const peakHour = Object.entries(hourlyDistribution)
      .sort(([,a], [,b]) => b - a)[0];
    
    const peakDay = Object.entries(dailyDistribution)
      .sort(([,a], [,b]) => b - a)[0];

    return {
      dateRange: {
        start: startDate.toISOString().split('T')[0],
        end: endDate.toISOString().split('T')[0]
      },
      totalBookings: bookings.length,
      peakHour: peakHour ? { hour: parseInt(peakHour[0]), bookings: peakHour[1] } : null,
      peakDay: peakDay ? { day: peakDay[0], bookings: peakDay[1] } : null,
      hourlyDistribution,
      dailyDistribution
    };
  }
}

module.exports = QuotaService;