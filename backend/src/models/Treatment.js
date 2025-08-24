const { DataTypes } = require('sequelize');

/**
 * @swagger
 * components:
 *   schemas:
 *     Treatment:
 *       type: object
 *       required:
 *         - name
 *         - storeId
 *         - duration
 *         - price
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the treatment
 *         name:
 *           type: string
 *           description: Treatment name
 *         description:
 *           type: string
 *           description: Treatment description
 *         category:
 *           type: string
 *           description: Treatment category
 *         duration:
 *           type: integer
 *           description: Treatment duration in minutes
 *         price:
 *           type: object
 *           properties:
 *             amount:
 *               type: number
 *               format: decimal
 *               description: Price amount
 *             currency:
 *               type: string
 *               description: Currency code (ISO 4217)
 *         requiredStaffLevel:
 *           type: string
 *           enum: [junior, senior, expert, any]
 *           description: Required staff expertise level
 *         requiredResources:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *           description: Required resource IDs
 *         maxConcurrentBookings:
 *           type: integer
 *           description: Maximum concurrent bookings allowed
 *         isActive:
 *           type: boolean
 *           description: Whether the treatment is active
 *         tags:
 *           type: array
 *           items:
 *             type: string
 *           description: Treatment tags for categorization
 *         storeId:
 *           type: string
 *           format: uuid
 *           description: Associated store ID
 *         metadata:
 *           type: object
 *           description: Additional treatment metadata
 */

module.exports = (sequelize) => {
  const Treatment = sequelize.define('Treatment', {
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
    category: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [1, 100]
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
          // Basic currency code validation (ISO 4217)
          if (!/^[A-Z]{3}$/.test(value.currency)) {
            throw new Error('Currency must be a valid 3-letter ISO 4217 code');
          }
        }
      }
    },
    requiredStaffLevel: {
      type: DataTypes.ENUM('junior', 'senior', 'expert', 'any'),
      allowNull: false,
      defaultValue: 'any'
    },
    requiredResources: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: [],
      allowNull: true
    },
    maxConcurrentBookings: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      validate: {
        min: 1,
        max: 100
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      defaultValue: [],
      allowNull: true
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'stores',
        key: 'id'
      }
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    }
  }, {
    tableName: 'treatments',
    indexes: [
      {
        fields: ['store_id']
      },
      {
        fields: ['category']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['name']
      },
      {
        fields: ['required_staff_level']
      },
      {
        fields: ['tags'],
        using: 'gin'
      }
    ]
  });

  // Instance methods
  Treatment.prototype.getFormattedPrice = function() {
    const { amount, currency } = this.price;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);
  };

  Treatment.prototype.getDurationFormatted = function() {
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

  Treatment.prototype.isResourceRequired = function(resourceId) {
    return this.requiredResources.includes(resourceId);
  };

  Treatment.prototype.canBePerformedBy = function(staffLevel) {
    if (this.requiredStaffLevel === 'any') return true;
    
    const levelHierarchy = {
      'junior': 1,
      'senior': 2,
      'expert': 3
    };
    
    const requiredLevel = levelHierarchy[this.requiredStaffLevel] || 0;
    const staffLevelValue = levelHierarchy[staffLevel] || 0;
    
    return staffLevelValue >= requiredLevel;
  };

  Treatment.prototype.hasTag = function(tag) {
    return this.tags.includes(tag);
  };

  Treatment.prototype.addTag = function(tag) {
    if (!this.hasTag(tag)) {
      this.tags = [...this.tags, tag];
    }
  };

  Treatment.prototype.removeTag = function(tag) {
    this.tags = this.tags.filter(t => t !== tag);
  };

  // Class methods
  Treatment.associate = (models) => {
    // Treatment belongs to Store
    Treatment.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store'
    });

    // Treatment has many Bookings
    Treatment.hasMany(models.Booking, {
      foreignKey: 'treatmentId',
      as: 'bookings'
    });

    // Treatment belongs to many Resources (many-to-many through treatment_resources)
    Treatment.belongsToMany(models.Resource, {
      through: 'treatment_resources',
      foreignKey: 'treatmentId',
      otherKey: 'resourceId',
      as: 'resources'
    });
  };

  // Class methods for querying
  Treatment.findActiveByStore = function(storeId) {
    return this.findAll({
      where: {
        storeId,
        isActive: true
      },
      order: [['name', 'ASC']]
    });
  };

  Treatment.findByCategory = function(storeId, category) {
    return this.findAll({
      where: {
        storeId,
        category,
        isActive: true
      },
      order: [['name', 'ASC']]
    });
  };

  Treatment.findByTag = function(storeId, tag) {
    return this.findAll({
      where: {
        storeId,
        tags: {
          [sequelize.Sequelize.Op.contains]: [tag]
        },
        isActive: true
      },
      order: [['name', 'ASC']]
    });
  };

  return Treatment;
};