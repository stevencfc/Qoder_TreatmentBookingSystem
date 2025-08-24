const { DataTypes } = require('sequelize');
const config = require('../config');

/**
 * @swagger
 * components:
 *   schemas:
 *     Booking:
 *       type: object
 *       required:
 *         - customerId
 *         - storeId
 *         - treatmentId
 *         - bookingDateTime
 *         - duration
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the booking
 *         customerId:
 *           type: string
 *           format: uuid
 *           description: Customer user ID
 *         storeId:
 *           type: string
 *           format: uuid
 *           description: Store ID where treatment will be performed
 *         treatmentId:
 *           type: string
 *           format: uuid
 *           description: Treatment being booked
 *         staffId:
 *           type: string
 *           format: uuid
 *           description: Assigned staff member ID
 *         bookingDateTime:
 *           type: string
 *           format: date-time
 *           description: Scheduled date and time for the booking
 *         duration:
 *           type: integer
 *           description: Booking duration in minutes
 *         status:
 *           type: string
 *           enum: [pending, confirmed, in_progress, completed, cancelled, no_show]
 *           description: Current booking status
 *         price:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *               format: decimal
 *             currency:
 *               type: string
 *         notes:
 *           type: string
 *           description: Additional booking notes
 *         cancellationReason:
 *           type: string
 *           description: Reason for cancellation (if cancelled)
 *         reminderSent:
 *           type: boolean
 *           description: Whether reminder has been sent
 *         metadata:
 *           type: object
 *           description: Additional booking metadata
 */

module.exports = (sequelize) => {
  const Booking = sequelize.define('Booking', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id'
      }
    },
    treatmentId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'treatments',
        key: 'id'
      }
    },
    staffId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    bookingDateTime: {
      type: DataTypes.DATE,
      allowNull: false,
      validate: {
        isDate: true,
        isAfter: new Date().toISOString()
      }
    },
    duration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 15,
        max: 480 // 8 hours maximum
      },
      comment: 'Duration in minutes'
    },
    status: {
      type: DataTypes.ENUM(
        config.bookingStatus.PENDING,
        config.bookingStatus.CONFIRMED,
        config.bookingStatus.IN_PROGRESS,
        config.bookingStatus.COMPLETED,
        config.bookingStatus.CANCELLED,
        config.bookingStatus.NO_SHOW
      ),
      allowNull: false,
      defaultValue: config.bookingStatus.PENDING
    },
    price: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {
        amount: 0,
        currency: 'USD'
      },
      validate: {
        isValidPrice(value) {
          if (!value || typeof value !== 'object') {
            throw new Error('Price must be an object');
          }
          if (typeof value.amount !== 'number' || value.amount < 0) {
            throw new Error('Price amount must be a non-negative number');
          }
          if (!value.currency || typeof value.currency !== 'string') {
            throw new Error('Price currency must be a valid string');
          }
        }
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cancellationReason: {
      type: DataTypes.STRING,
      allowNull: true
    },
    reminderSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    }
  }, {
    tableName: 'bookings',
    indexes: [
      {
        fields: ['customer_id']
      },
      {
        fields: ['store_id']
      },
      {
        fields: ['treatment_id']
      },
      {
        fields: ['staff_id']
      },
      {
        fields: ['booking_date_time']
      },
      {
        fields: ['status']
      },
      {
        fields: ['booking_date_time', 'status']
      },
      {
        unique: true,
        fields: ['staff_id', 'booking_date_time'],
        where: {
          status: {
            [sequelize.Sequelize.Op.notIn]: [
              config.bookingStatus.CANCELLED,
              config.bookingStatus.NO_SHOW
            ]
          }
        },
        name: 'unique_staff_booking_time'
      }
    ],
    hooks: {
      beforeUpdate: (booking, options) => {
        // Set completion timestamp when status changes to completed
        if (booking.changed('status') && booking.status === config.bookingStatus.COMPLETED) {
          booking.completedAt = new Date();
        }
        
        // Set cancellation timestamp when status changes to cancelled
        if (booking.changed('status') && booking.status === config.bookingStatus.CANCELLED) {
          booking.cancelledAt = new Date();
        }
      }
    }
  });

  // Instance methods
  Booking.prototype.getEndDateTime = function() {
    const endTime = new Date(this.bookingDateTime);
    endTime.setMinutes(endTime.getMinutes() + this.duration);
    return endTime;
  };

  Booking.prototype.isOverlapping = function(startTime, endTime) {
    const bookingStart = new Date(this.bookingDateTime);
    const bookingEnd = this.getEndDateTime();
    
    return (
      (startTime < bookingEnd && startTime >= bookingStart) ||
      (endTime > bookingStart && endTime <= bookingEnd) ||
      (startTime <= bookingStart && endTime >= bookingEnd)
    );
  };

  Booking.prototype.canBeCancelled = function() {
    const now = new Date();
    const bookingTime = new Date(this.bookingDateTime);
    const timeDifference = bookingTime.getTime() - now.getTime();
    const hoursUntilBooking = timeDifference / (1000 * 60 * 60);
    
    // Can cancel if booking is not completed/cancelled and is more than cancellation deadline hours away
    return (
      ![config.bookingStatus.COMPLETED, config.bookingStatus.CANCELLED, config.bookingStatus.NO_SHOW].includes(this.status) &&
      hoursUntilBooking >= (config.booking.cancellationDeadlineHours || 24)
    );
  };

  Booking.prototype.canBeModified = function() {
    const now = new Date();
    const bookingTime = new Date(this.bookingDateTime);
    
    return (
      this.status === config.bookingStatus.PENDING ||
      this.status === config.bookingStatus.CONFIRMED
    ) && bookingTime > now;
  };

  Booking.prototype.isUpcoming = function() {
    const now = new Date();
    const bookingTime = new Date(this.bookingDateTime);
    return bookingTime > now && this.status !== config.bookingStatus.CANCELLED;
  };

  Booking.prototype.isPast = function() {
    const now = new Date();
    const bookingEnd = this.getEndDateTime();
    return bookingEnd < now;
  };

  Booking.prototype.getFormattedPrice = function() {
    const { amount, currency } = this.price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  Booking.prototype.getDurationFormatted = function() {
    const hours = Math.floor(this.duration / 60);
    const minutes = this.duration % 60;
    
    if (hours === 0) {
      return `${minutes}m`;
    } else if (minutes === 0) {
      return `${hours}h`;
    } else {
      return `${hours}h ${minutes}m`;
    }
  };

  // Class methods
  Booking.associate = (models) => {
    // Booking belongs to Customer (User)
    Booking.belongsTo(models.User, {
      foreignKey: 'customerId',
      as: 'customer'
    });

    // Booking belongs to Staff (User)
    Booking.belongsTo(models.User, {
      foreignKey: 'staffId',
      as: 'staff'
    });

    // Booking belongs to Store
    Booking.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store'
    });

    // Booking belongs to Treatment
    Booking.belongsTo(models.Treatment, {
      foreignKey: 'treatmentId',
      as: 'treatment'
    });
  };

  // Class methods for querying
  Booking.findUpcomingByCustomer = function(customerId) {
    return this.findAll({
      where: {
        customerId,
        bookingDateTime: {
          [sequelize.Sequelize.Op.gt]: new Date()
        },
        status: {
          [sequelize.Sequelize.Op.notIn]: [
            config.bookingStatus.CANCELLED,
            config.bookingStatus.NO_SHOW
          ]
        }
      },
      order: [['bookingDateTime', 'ASC']],
      include: ['treatment', 'store', 'staff']
    });
  };

  Booking.findByDateRange = function(storeId, startDate, endDate) {
    return this.findAll({
      where: {
        storeId,
        bookingDateTime: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        }
      },
      order: [['bookingDateTime', 'ASC']],
      include: ['customer', 'treatment', 'staff']
    });
  };

  Booking.findConflicting = function(staffId, startTime, endTime, excludeBookingId = null) {
    const where = {
      staffId,
      status: {
        [sequelize.Sequelize.Op.notIn]: [
          config.bookingStatus.CANCELLED,
          config.bookingStatus.NO_SHOW
        ]
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
    };

    if (excludeBookingId) {
      where.id = {
        [sequelize.Sequelize.Op.ne]: excludeBookingId
      };
    }

    return this.findAll({ where });
  };

  return Booking;
};