const { DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const config = require('../config');

/**
 * @swagger
 * components:
 *   schemas:
 *     User:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - role
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the user
 *         email:
 *           type: string
 *           format: email
 *           description: User's email address (unique)
 *         password:
 *           type: string
 *           format: password
 *           description: Hashed password
 *         firstName:
 *           type: string
 *           description: User's first name
 *         lastName:
 *           type: string
 *           description: User's last name
 *         role:
 *           type: string
 *           enum: [super_admin, store_admin, staff, customer]
 *           description: User's role in the system
 *         phone:
 *           type: string
 *           description: User's phone number
 *         isActive:
 *           type: boolean
 *           description: Whether the user account is active
 *         isEmailVerified:
 *           type: boolean
 *           description: Whether the user's email is verified
 *         storeId:
 *           type: string
 *           format: uuid
 *           description: Associated store ID (for store_admin and staff)
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *           description: Last login timestamp
 *         metadata:
 *           type: object
 *           description: Additional user metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: User creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 */

module.exports = (sequelize) => {
  const User = sequelize.define('User', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true,
        len: [5, 255]
      }
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        len: [8, 255]
      }
    },
    firstName: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [1, 100]
      }
    },
    lastName: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [1, 100]
      }
    },
    role: {
      type: DataTypes.ENUM(
        config.roles.SUPER_ADMIN,
        config.roles.STORE_ADMIN,
        config.roles.STAFF,
        config.roles.CUSTOMER
      ),
      allowNull: false,
      defaultValue: config.roles.CUSTOMER
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
      validate: {
        len: [10, 20]
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    isEmailVerified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
      allowNull: false
    },
    storeId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'stores',
        key: 'id'
      }
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    }
  }, {
    tableName: 'users',
    indexes: [
      {
        unique: true,
        fields: ['email']
      },
      {
        fields: ['role']
      },
      {
        fields: ['store_id']
      },
      {
        fields: ['is_active']
      }
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed('password') && user.password) {
          const salt = await bcrypt.genSalt(12);
          user.password = await bcrypt.hash(user.password, salt);
        }
      }
    }
  });

  // Instance methods
  User.prototype.validatePassword = async function(password) {
    return bcrypt.compare(password, this.password);
  };

  User.prototype.getFullName = function() {
    return `${this.firstName || ''} ${this.lastName || ''}`.trim();
  };

  User.prototype.toJSON = function() {
    const values = { ...this.get() };
    delete values.password; // Never return password
    return values;
  };

  User.prototype.canAccessStore = function(storeId) {
    if (this.role === config.roles.SUPER_ADMIN) return true;
    if (this.role === config.roles.CUSTOMER) return false;
    return this.storeId === storeId;
  };

  User.prototype.hasPermission = function(permission, storeId = null) {
    const rolePermissions = {
      [config.roles.SUPER_ADMIN]: ['*'],
      [config.roles.STORE_ADMIN]: [
        'store:read', 'store:update', 'booking:create', 'booking:read', 
        'booking:update', 'booking:delete', 'treatment:create', 'treatment:read',
        'treatment:update', 'treatment:delete', 'user:read', 'user:create'
      ],
      [config.roles.STAFF]: [
        'booking:read', 'booking:update', 'treatment:read', 'store:read'
      ],
      [config.roles.CUSTOMER]: [
        'booking:create', 'booking:read_own', 'booking:update_own', 
        'booking:delete_own', 'treatment:read', 'store:read'
      ]
    };

    const userPermissions = rolePermissions[this.role] || [];
    
    if (userPermissions.includes('*')) return true;
    if (userPermissions.includes(permission)) {
      if (storeId && !this.canAccessStore(storeId)) return false;
      return true;
    }
    
    return false;
  };

  // Class methods
  User.associate = (models) => {
    // User belongs to Store (for store_admin and staff)
    User.belongsTo(models.Store, {
      foreignKey: 'storeId',
      as: 'store',
      allowNull: true
    });

    // User has many Bookings (as customer)
    User.hasMany(models.Booking, {
      foreignKey: 'customerId',
      as: 'customerBookings'
    });

    // User has many Bookings (as staff)
    User.hasMany(models.Booking, {
      foreignKey: 'staffId',
      as: 'staffBookings'
    });
  };

  return User;
};