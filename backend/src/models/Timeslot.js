const { DataTypes } = require('sequelize');

/**
 * @swagger
 * components:
 *   schemas:
 *     Timeslot:
 *       type: object
 *       required:
 *         - storeId
 *         - startTime
 *         - endTime
 *         - maxCapacity
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the timeslot
 *         storeId:
 *           type: string
 *           format: uuid
 *           description: Associated store ID
 *         startTime:
 *           type: string
 *           format: date-time
 *           description: Slot start time
 *         endTime:
 *           type: string
 *           format: date-time
 *           description: Slot end time
 *         maxCapacity:
 *           type: integer
 *           description: Maximum bookings allowed in this slot
 *         currentBookings:
 *           type: integer
 *           description: Current number of bookings
 *         isActive:
 *           type: boolean
 *           description: Whether the timeslot is active
 *         treatmentTypes:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Allowed treatment type IDs (empty = all allowed)
 *         staffIds:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Available staff member IDs
 *         metadata:
 *           type: object
 *           description: Additional timeslot metadata
 */

module.exports = (sequelize) => {
  const Timeslot = sequelize.define('Timeslot', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id'
      }
    },
    startTime: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true
      }
    },
    endTime: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true,
        isAfterStartTime(value) {
          if (value <= this.startTime) {
            throw new Error('End time must be after start time');
          }
        }
      }
    },
    maxCapacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 100
      }
    },
    currentBookings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    treatmentTypes: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: [],
      allowNull: true,
      comment: 'Allowed treatment type IDs (empty array = all treatments allowed)'
    },
    staffIds: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: [],
      allowNull: true,
      comment: 'Available staff member IDs'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    }
  }, {
    tableName: 'timeslots',
    indexes: [
      {
        fields: ['store_id']
      },
      {
        fields: ['start_time']
      },
      {
        fields: ['end_time']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['start_time', 'end_time']
      },
      {
        fields: ['store_id', 'start_time']
      },
      {
        unique: true,
        fields: ['store_id', 'start_time', 'end_time'],
        name: 'unique_store_timeslot'
      }
    ],
    hooks: {
      beforeCreate: (timeslot) => {
        // Validate that the timeslot doesn't overlap with existing ones
        return Timeslot.validateNoOverlap(timeslot);
      },
      beforeUpdate: (timeslot) => {
        if (timeslot.changed('startTime') || timeslot.changed('endTime')) {
          return Timeslot.validateNoOverlap(timeslot);
        }
      }
    }
  });

  // Instance methods
  Timeslot.prototype.getDurationMinutes = function() {
    const startTime = new Date(this.startTime);
    const endTime = new Date(this.endTime);
    return Math.round((endTime - startTime) / (1000 * 60));
  };

  Timeslot.prototype.isAvailable = function() {
    return this.isActive && this.currentBookings < this.maxCapacity;
  };

  Timeslot.prototype.getAvailableCapacity = function() {
    return Math.max(0, this.maxCapacity - this.currentBookings);
  };

  Timeslot.prototype.canAccommodateTreatment = function(treatmentId) {
    // If no specific treatment types are set, all treatments are allowed
    if (!this.treatmentTypes || this.treatmentTypes.length === 0) {
      return true;
    }
    return this.treatmentTypes.includes(treatmentId);
  };

  Timeslot.prototype.hasAvailableStaff = function(requiredStaffId = null) {
    // If no specific staff IDs are set, assume any staff can work
    if (!this.staffIds || this.staffIds.length === 0) {
      return true;
    }
    
    // If a specific staff member is required, check if they're available
    if (requiredStaffId) {
      return this.staffIds.includes(requiredStaffId);
    }
    
    // Otherwise, just check if any staff is available
    return this.staffIds.length > 0;
  };

  Timeslot.prototype.overlaps = function(startTime, endTime) {
    const slotStart = new Date(this.startTime);
    const slotEnd = new Date(this.endTime);
    const checkStart = new Date(startTime);
    const checkEnd = new Date(endTime);
    
    return (
      (checkStart < slotEnd && checkStart >= slotStart) ||
      (checkEnd > slotStart && checkEnd <= slotEnd) ||
      (checkStart <= slotStart && checkEnd >= slotEnd)
    );
  };

  Timeslot.prototype.incrementBookings = async function() {
    this.currentBookings += 1;
    await this.save();
  };

  Timeslot.prototype.decrementBookings = async function() {
    this.currentBookings = Math.max(0, this.currentBookings - 1);
    await this.save();
  };

  // Class methods
  Timeslot.associate = (models) => {
    // Timeslot belongs to Store
    Timeslot.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store'
    });
  };

  // Class methods for validation and querying
  Timeslot.validateNoOverlap = async function(timeslot) {
    const overlappingSlots = await this.findAll({
      where: {
        id: {
          [sequelize.Sequelize.Op.ne]: timeslot.id || null
        },
        storeId: timeslot.storeId,
        [sequelize.Sequelize.Op.or]: [
          {
            startTime: {
              [sequelize.Sequelize.Op.between]: [timeslot.startTime, timeslot.endTime]
            }
          },
          {
            endTime: {
              [sequelize.Sequelize.Op.between]: [timeslot.startTime, timeslot.endTime]
            }
          },
          {
            [sequelize.Sequelize.Op.and]: [
              {
                startTime: {
                  [sequelize.Sequelize.Op.lte]: timeslot.startTime
                }
              },
              {
                endTime: {
                  [sequelize.Sequelize.Op.gte]: timeslot.endTime
                }
              }
            ]
          }
        ]
      }
    });

    if (overlappingSlots.length > 0) {
      throw new Error('Timeslot overlaps with existing timeslot');
    }
  };

  Timeslot.findAvailableForDate = function(storeId, date) {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.findAll({
      where: {
        storeId,
        isActive: true,
        startTime: {
          [sequelize.Sequelize.Op.between]: [startOfDay, endOfDay]
        },
        currentBookings: {
          [sequelize.Sequelize.Op.lt]: sequelize.col('max_capacity')
        }
      },
      order: [['startTime', 'ASC']]
    });
  };

  Timeslot.findForTreatment = function(storeId, treatmentId, startDate, endDate) {
    return this.findAll({
      where: {
        storeId,
        isActive: true,
        startTime: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        },
        currentBookings: {
          [sequelize.Sequelize.Op.lt]: sequelize.col('max_capacity')
        },
        [sequelize.Sequelize.Op.or]: [
          {
            treatmentTypes: {
              [sequelize.Sequelize.Op.eq]: []
            }
          },
          {
            treatmentTypes: {
              [sequelize.Sequelize.Op.contains]: [treatmentId]
            }
          }
        ]
      },
      order: [['startTime', 'ASC']]
    });
  };

  Timeslot.generateDailySlots = async function(storeId, date, slotDuration = 60, capacity = 1) {
    const { Store } = sequelize.models;
    
    const store = await Store.findByPk(storeId);
    if (!store) {
      throw new Error('Store not found');
    }

    const dayName = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: store.timezone 
    }).toLowerCase();

    const operatingHours = store.operatingHours[dayName];
    if (!operatingHours || operatingHours.closed) {
      return []; // No slots for closed days
    }

    const slots = [];
    const [openHour, openMinute] = operatingHours.open.split(':').map(Number);
    const [closeHour, closeMinute] = operatingHours.close.split(':').map(Number);

    const startTime = new Date(date);
    startTime.setHours(openHour, openMinute, 0, 0);

    const endTime = new Date(date);
    endTime.setHours(closeHour, closeMinute, 0, 0);

    let currentTime = new Date(startTime);

    while (currentTime < endTime) {
      const slotEndTime = new Date(currentTime);
      slotEndTime.setMinutes(slotEndTime.getMinutes() + slotDuration);

      if (slotEndTime <= endTime) {
        slots.push({
          storeId,
          startTime: new Date(currentTime),
          endTime: slotEndTime,
          maxCapacity: capacity,
          currentBookings: 0
        });
      }

      currentTime.setMinutes(currentTime.getMinutes() + slotDuration);
    }

    return slots;
  };

  return Timeslot;
};