const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');

class AvailabilityService {
  /**
   * Generate timeslots for a store on a specific date
   */
  static async generateTimeslots(storeId, date, slotDuration = 60, maxCapacity = 1) {
    const { Store, Timeslot } = sequelize.models;
    
    const store = await Store.findByPk(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    // Clear existing timeslots for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    await Timeslot.destroy({
      where: {
        storeId,
        startTime: {
          [sequelize.Sequelize.Op.between]: [startOfDay, endOfDay]
        }
      }
    });

    // Generate new timeslots
    const slotsData = await Timeslot.generateDailySlots(storeId, date, slotDuration, maxCapacity);
    
    if (slotsData.length > 0) {
      await Timeslot.bulkCreate(slotsData);
    }

    logger.logDatabaseOperation('generate', 'timeslots', null, {
      storeId,
      date: date.toISOString().split('T')[0],
      slotsGenerated: slotsData.length
    });

    return slotsData.length;
  }

  /**
   * Check real-time availability for a treatment at a specific time
   */
  static async checkAvailability(storeId, treatmentId, startTime, duration) {
    const { Treatment, Booking, Resource, User, Timeslot } = sequelize.models;
    
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    // Get treatment details
    const treatment = await Treatment.findByPk(treatmentId, {
      include: [{ model: Resource, as: 'resources' }]
    });
    
    if (!treatment || !treatment.isActive) {
      return {
        available: false,
        reason: 'Treatment not found or inactive'
      };
    }

    // Check if store is open
    const store = await sequelize.models.Store.findByPk(storeId);
    if (!store.isOpenOnDate(startTime)) {
      return {
        available: false,
        reason: 'Store is closed on this date'
      };
    }

    // Check timeslot availability
    const availableSlots = await Timeslot.findAll({
      where: {
        storeId,
        startTime: {
          [sequelize.Sequelize.Op.lte]: startTime
        },
        endTime: {
          [sequelize.Sequelize.Op.gte]: endTime
        },
        isActive: true,
        currentBookings: {
          [sequelize.Sequelize.Op.lt]: sequelize.col('max_capacity')
        }
      }
    });

    if (availableSlots.length === 0) {
      return {
        available: false,
        reason: 'No available timeslots'
      };
    }

    // Check resource availability
    const requiredResources = treatment.resources || [];
    for (const resource of requiredResources) {
      const isResourceAvailable = await resource.isAvailable(startTime, endTime);
      if (!isResourceAvailable) {
        return {
          available: false,
          reason: `Resource ${resource.name} is not available`
        };
      }
    }

    // Check concurrent booking limits
    const existingBookings = await Booking.count({
      where: {
        treatmentId,
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

    if (existingBookings >= treatment.maxConcurrentBookings) {
      return {
        available: false,
        reason: 'Maximum concurrent bookings reached for this treatment'
      };
    }

    return {
      available: true,
      timeslot: availableSlots[0],
      availableCapacity: availableSlots[0].maxCapacity - availableSlots[0].currentBookings
    };
  }

  /**
   * Get available staff for a treatment at a specific time
   */
  static async getAvailableStaff(storeId, treatmentId, startTime, duration) {
    const { User, Booking, Treatment } = sequelize.models;
    
    const endTime = new Date(startTime.getTime() + duration * 60000);
    
    // Get treatment to check required staff level
    const treatment = await Treatment.findByPk(treatmentId);
    if (!treatment) {
      throw new Error('Treatment not found');
    }

    // Get all staff members for the store
    const allStaff = await User.findAll({
      where: {
        storeId,
        role: {
          [sequelize.Sequelize.Op.in]: [config.roles.STAFF, config.roles.STORE_ADMIN]
        },
        isActive: true
      }
    });

    // Filter staff by qualification level
    const qualifiedStaff = allStaff.filter(staff => {
      return treatment.canBePerformedBy(staff.metadata?.skillLevel || 'junior');
    });

    // Check availability for each qualified staff member
    const availableStaff = [];
    
    for (const staff of qualifiedStaff) {
      const conflictingBookings = await Booking.findConflicting(staff.id, startTime, endTime);
      
      if (conflictingBookings.length === 0) {
        availableStaff.push({
          id: staff.id,
          name: staff.getFullName(),
          skillLevel: staff.metadata?.skillLevel || 'junior'
        });
      }
    }

    return availableStaff;
  }

  /**
   * Get available time slots for a treatment on a specific date
   */
  static async getAvailableSlots(storeId, treatmentId, date) {
    const { Treatment, Timeslot } = sequelize.models;
    
    const treatment = await Treatment.findByPk(treatmentId);
    if (!treatment) {
      throw new Error('Treatment not found');
    }

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Get all timeslots for the date
    const timeslots = await Timeslot.findAll({
      where: {
        storeId,
        startTime: {
          [sequelize.Sequelize.Op.between]: [startOfDay, endOfDay]
        },
        isActive: true
      },
      order: [['startTime', 'ASC']]
    });

    const availableSlots = [];

    for (const slot of timeslots) {
      // Check if the slot can accommodate the treatment duration
      const slotDuration = slot.getDurationMinutes();
      if (slotDuration >= treatment.duration) {
        const availability = await this.checkAvailability(
          storeId, 
          treatmentId, 
          slot.startTime, 
          treatment.duration
        );

        if (availability.available) {
          const staff = await this.getAvailableStaff(
            storeId, 
            treatmentId, 
            slot.startTime, 
            treatment.duration
          );

          availableSlots.push({
            startTime: slot.startTime,
            endTime: new Date(slot.startTime.getTime() + treatment.duration * 60000),
            availableCapacity: availability.availableCapacity,
            availableStaff: staff.length,
            staff: staff
          });
        }
      }
    }

    return availableSlots;
  }

  /**
   * Reserve a timeslot (increment booking count)
   */
  static async reserveTimeslot(storeId, startTime, endTime) {
    const { Timeslot } = sequelize.models;
    
    const timeslot = await Timeslot.findOne({
      where: {
        storeId,
        startTime: {
          [sequelize.Sequelize.Op.lte]: startTime
        },
        endTime: {
          [sequelize.Sequelize.Op.gte]: endTime
        },
        isActive: true
      }
    });

    if (timeslot) {
      await timeslot.incrementBookings();
      return timeslot;
    }

    return null;
  }

  /**
   * Release a timeslot (decrement booking count)
   */
  static async releaseTimeslot(storeId, startTime, endTime) {
    const { Timeslot } = sequelize.models;
    
    const timeslot = await Timeslot.findOne({
      where: {
        storeId,
        startTime: {
          [sequelize.Sequelize.Op.lte]: startTime
        },
        endTime: {
          [sequelize.Sequelize.Op.gte]: endTime
        }
      }
    });

    if (timeslot) {
      await timeslot.decrementBookings();
      return timeslot;
    }

    return null;
  }

  /**
   * Get availability summary for multiple days
   */
  static async getAvailabilitySummary(storeId, startDate, endDate, treatmentId = null) {
    const { Store, Treatment } = sequelize.models;
    
    const store = await Store.findByPk(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    const summary = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const isOpen = store.isOpenOnDate(currentDate);
      
      let availableSlots = 0;
      let totalSlots = 0;
      
      if (isOpen) {
        if (treatmentId) {
          const slots = await this.getAvailableSlots(storeId, treatmentId, currentDate);
          availableSlots = slots.length;
          
          // Get total possible slots for this treatment
          const treatment = await Treatment.findByPk(treatmentId);
          const operatingHours = store.getOperatingHoursForDate(currentDate);
          if (operatingHours && !operatingHours.closed) {
            const openMinutes = this.calculateOperatingMinutes(operatingHours);
            totalSlots = Math.floor(openMinutes / treatment.duration);
          }
        } else {
          // General availability - count all available timeslots
          const timeslots = await sequelize.models.Timeslot.findAvailableForDate(storeId, currentDate);
          availableSlots = timeslots.length;
          totalSlots = timeslots.length;
        }
      }

      summary.push({
        date: dateStr,
        isOpen,
        availableSlots,
        totalSlots,
        utilizationRate: totalSlots > 0 ? Math.round((1 - availableSlots / totalSlots) * 100) : 0
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return summary;
  }

  /**
   * Calculate operating minutes from operating hours
   */
  static calculateOperatingMinutes(operatingHours) {
    if (!operatingHours || operatingHours.closed) {
      return 0;
    }

    const [openHour, openMinute] = operatingHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = operatingHours.close.split(':').map(Number);
    
    const openTime = openHour * 60 + openMinute;
    const closeTime = closeHour * 60 + closeMinute;
    
    return closeTime - openTime;
  }
}

module.exports = AvailabilityService;