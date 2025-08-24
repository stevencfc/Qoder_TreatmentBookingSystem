const { DataTypes } = require('sequelize');

/**
 * @swagger
 * components:
 *   schemas:
 *     Resource:
 *       type: object
 *       required:
 *         - name
 *         - type
 *         - storeId
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the resource
 *         name:
 *           type: string
 *           description: Resource name
 *         description:
 *           type: string
 *           description: Resource description
 *         type:
 *           type: string
 *           enum: [room, equipment, tool, other]
 *           description: Type of resource
 *         capacity:
 *           type: integer
 *           description: Maximum concurrent usage capacity
 *         isActive:
 *           type: boolean
 *           description: Whether the resource is active
 *         storeId:
 *           type: string
 *           format: uuid
 *           description: Associated store ID
 *         specifications:
 *           type: object
 *           description: Resource specifications and features
 *         metadata:
 *           type: object
 *           description: Additional resource metadata
 */

module.exports = (sequelize) => {
  const Resource = sequelize.define('Resource', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [1, 255]
      }
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    type: {
      type: DataTypes.ENUM('room', 'equipment', 'tool', 'other'),
      allowNull: false
    },
    capacity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 100
      },
      comment: 'Maximum concurrent usage capacity'
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
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
    specifications: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true,
      comment: 'Resource specifications and features'
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    }
  }, {
    tableName: 'resources',
    indexes: [
      {
        fields: ['store_id']
      },
      {
        fields: ['type']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['name']
      }
    ]
  });

  // Instance methods
  Resource.prototype.isAvailable = async function(startTime, endTime, excludeBookingIds = []) {
    const { Booking } = sequelize.models;
    
    // Count current bookings that require this resource during the specified time
    const conflictingBookings = await Booking.findAll({
      where: {
        id: {
          [sequelize.Sequelize.Op.notIn]: excludeBookingIds
        },
        status: {
          [sequelize.Sequelize.Op.notIn]: ['cancelled', 'no_show']
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
      },
      include: [{
        model: sequelize.models.Treatment,
        as: 'treatment',
        where: {
          requiredResources: {
            [sequelize.Sequelize.Op.contains]: [this.id]
          }
        }
      }]
    });

    return conflictingBookings.length < this.capacity;
  };

  Resource.prototype.getCurrentUsage = async function() {
    const { Booking } = sequelize.models;
    const now = new Date();
    
    const currentBookings = await Booking.findAll({
      where: {
        bookingDateTime: {
          [sequelize.Sequelize.Op.lte]: now
        },
        status: {
          [sequelize.Sequelize.Op.in]: ['confirmed', 'in_progress']
        }
      },
      include: [{
        model: sequelize.models.Treatment,
        as: 'treatment',
        where: {
          requiredResources: {
            [sequelize.Sequelize.Op.contains]: [this.id]
          }
        }
      }]
    });

    // Filter bookings that are actually ongoing (haven't ended yet)
    const ongoingBookings = currentBookings.filter(booking => {
      const endTime = new Date(booking.bookingDateTime);
      endTime.setMinutes(endTime.getMinutes() + booking.duration);
      return endTime > now;
    });

    return {
      current: ongoingBookings.length,
      capacity: this.capacity,
      available: this.capacity - ongoingBookings.length,
      utilizationPercentage: (ongoingBookings.length / this.capacity) * 100
    };
  };

  Resource.prototype.getSchedule = async function(startDate, endDate) {
    const { Booking } = sequelize.models;
    
    const bookings = await Booking.findAll({
      where: {
        bookingDateTime: {
          [sequelize.Sequelize.Op.between]: [startDate, endDate]
        },
        status: {
          [sequelize.Sequelize.Op.notIn]: ['cancelled', 'no_show']
        }
      },
      include: [{
        model: sequelize.models.Treatment,
        as: 'treatment',
        where: {
          requiredResources: {
            [sequelize.Sequelize.Op.contains]: [this.id]
          }
        }
      }, {
        model: sequelize.models.User,
        as: 'customer',
        attributes: ['id', 'firstName', 'lastName', 'email']
      }],
      order: [['bookingDateTime', 'ASC']]
    });

    return bookings.map(booking => ({
      bookingId: booking.id,
      customerName: booking.customer.getFullName(),
      treatmentName: booking.treatment.name,
      startTime: booking.bookingDateTime,
      endTime: booking.getEndDateTime(),
      status: booking.status
    }));
  };

  // Class methods
  Resource.associate = (models) => {
    // Resource belongs to Store
    Resource.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store'
    });

    // Resource belongs to many Treatments (many-to-many through treatment_resources)
    Resource.belongsToMany(models.Treatment, {
      through: 'treatment_resources',
      foreignKey: 'resourceId',
      otherKey: 'treatmentId',
      as: 'treatments'
    });
  };

  // Class methods for querying
  Resource.findActiveByStore = function(storeId) {
    return this.findAll({
      where: {
        storeId,
        isActive: true
      },
      order: [['type', 'ASC'], ['name', 'ASC']]
    });
  };

  Resource.findByType = function(storeId, type) {
    return this.findAll({
      where: {
        storeId,
        type,
        isActive: true
      },
      order: [['name', 'ASC']]
    });
  };

  Resource.findAvailableForTimeSlot = async function(storeId, startTime, endTime, excludeBookingIds = []) {
    const resources = await this.findActiveByStore(storeId);
    const availableResources = [];

    for (const resource of resources) {
      const isAvailable = await resource.isAvailable(startTime, endTime, excludeBookingIds);
      if (isAvailable) {
        availableResources.push(resource);
      }
    }

    return availableResources;
  };

  return Resource;
};