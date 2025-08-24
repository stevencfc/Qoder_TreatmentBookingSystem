const { DataTypes } = require('sequelize');

/**
 * @swagger
 * components:
 *   schemas:
 *     Store:
 *       type: object
 *       required:
 *         - name
 *         - timezone
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the store
 *         name:
 *           type: string
 *           description: Store name
 *         description:
 *           type: string
 *           description: Store description
 *         address:
 *           type: object
 *           properties:
 *             street:
 *               type: string
 *             city:
 *               type: string
 *             state:
 *               type: string
 *             postalCode:
 *               type: string
 *             country:
 *               type: string
 *         phone:
 *           type: string
 *           description: Store contact phone
 *         email:
 *           type: string
 *           format: email
 *           description: Store contact email
 *         website:
 *           type: string
 *           format: uri
 *           description: Store website URL
 *         timezone:
 *           type: string
 *           description: Store timezone (e.g., America/New_York)
 *         operatingHours:
 *           type: object
 *           description: Weekly operating hours
 *         isActive:
 *           type: boolean
 *           description: Whether the store is active
 *         settings:
 *           type: object
 *           description: Store-specific settings
 *         metadata:
 *           type: object
 *           description: Additional store metadata
 */

module.exports = (sequelize) => {
  const Store = sequelize.define('Store', {
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
    address: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {},
      validate: {
        isValidAddress(value) {
          if (value && typeof value === 'object') {
            const requiredFields = ['street', 'city', 'country'];
            const hasRequiredFields = requiredFields.every(field => 
              value[field] && typeof value[field] === 'string'
            );
            if (!hasRequiredFields) {
              throw new Error('Address must include street, city, and country');
            }
          }
        }
      }
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [10, 20]
      }
    },
    email: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isEmail: true
      }
    },
    website: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        isUrl: true
      }
    },
    timezone: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'UTC',
      validate: {
        len: [1, 50]
      }
    },
    operatingHours: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {
        monday: { open: '09:00', close: '17:00', closed: false },
        tuesday: { open: '09:00', close: '17:00', closed: false },
        wednesday: { open: '09:00', close: '17:00', closed: false },
        thursday: { open: '09:00', close: '17:00', closed: false },
        friday: { open: '09:00', close: '17:00', closed: false },
        saturday: { open: '09:00', close: '15:00', closed: false },
        sunday: { open: '10:00', close: '14:00', closed: true }
      },
      validate: {
        isValidOperatingHours(value) {
          if (value && typeof value === 'object') {
            const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            const timeRegex = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
            
            for (const day of days) {
              if (value[day]) {
                const dayHours = value[day];
                if (typeof dayHours !== 'object') {
                  throw new Error(`Operating hours for ${day} must be an object`);
                }
                
                if (!dayHours.closed && (!timeRegex.test(dayHours.open) || !timeRegex.test(dayHours.close))) {
                  throw new Error(`Invalid time format for ${day}. Use HH:MM format`);
                }
              }
            }
          }
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    settings: {
      type: DataTypes.JSONB,
      defaultValue: {
        maxAdvanceBookingDays: 90,
        cancellationDeadlineHours: 24,
        bufferTimeMinutes: 15,
        allowOnlineBooking: true,
        requireApproval: false,
        sendNotifications: true
      },
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    }
  }, {
    tableName: 'stores',
    indexes: [
      {
        fields: ['name']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['timezone']
      }
    ]
  });

  // Instance methods
  Store.prototype.isOpenNow = function() {
    const now = new Date();
    const dayName = now.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: this.timezone 
    }).toLowerCase();
    
    const todayHours = this.operatingHours[dayName];
    if (!todayHours || todayHours.closed) {
      return false;
    }
    
    const currentTime = now.toLocaleTimeString('en-US', {
      hour12: false,
      timeZone: this.timezone,
      hour: '2-digit',
      minute: '2-digit'
    });
    
    return currentTime >= todayHours.open && currentTime <= todayHours.close;
  };

  Store.prototype.getOperatingHoursForDate = function(date) {
    const dayName = date.toLocaleDateString('en-US', { 
      weekday: 'long',
      timeZone: this.timezone 
    }).toLowerCase();
    
    return this.operatingHours[dayName] || null;
  };

  Store.prototype.isOpenOnDate = function(date) {
    const hours = this.getOperatingHoursForDate(date);
    return hours && !hours.closed;
  };

  Store.prototype.getFormattedAddress = function() {
    if (!this.address || Object.keys(this.address).length === 0) {
      return '';
    }
    
    const { street, city, state, postalCode, country } = this.address;
    const parts = [street, city, state, postalCode, country].filter(Boolean);
    return parts.join(', ');
  };

  // Class methods
  Store.associate = (models) => {
    // Store has many Users (staff and admins)
    Store.hasMany(models.User, {
      foreignKey: 'storeId',
      as: 'staff'
    });

    // Store has many Treatments
    Store.hasMany(models.Treatment, {
      foreignKey: 'storeId',
      as: 'treatments'
    });

    // Store has many Bookings
    Store.hasMany(models.Booking, {
      foreignKey: 'storeId',
      as: 'bookings'
    });

    // Store has many Resources
    Store.hasMany(models.Resource, {
      foreignKey: 'storeId',
      as: 'resources'
    });

    // Store has many Timeslots
    Store.hasMany(models.Timeslot, {
      foreignKey: 'storeId',
      as: 'timeslots'
    });
  };

  return Store;
};