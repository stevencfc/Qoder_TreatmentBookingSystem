const { DataTypes } = require('sequelize');
const crypto = require('crypto');
const config = require('../config');

/**
 * @swagger
 * components:
 *   schemas:
 *     WebhookSubscription:
 *       type: object
 *       required:
 *         - url
 *         - events
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: Unique identifier for the webhook subscription
 *         url:
 *           type: string
 *           format: uri
 *           description: Webhook endpoint URL
 *         events:
 *           type: array
 *           items:
 *             type: string
 *             enum: [booking.created, booking.updated, booking.cancelled, booking.completed, availability.changed]
 *           description: List of events to subscribe to
 *         isActive:
 *           type: boolean
 *           description: Whether the webhook is active
 *         secret:
 *           type: string
 *           description: Secret key for webhook signature verification
 *         retryCount:
 *           type: integer
 *           description: Number of retry attempts on failure
 *         maxRetries:
 *           type: integer
 *           description: Maximum number of retry attempts
 *         lastSuccessAt:
 *           type: string
 *           format: date-time
 *           description: Last successful delivery timestamp
 *         lastFailureAt:
 *           type: string
 *           format: date-time
 *           description: Last failed delivery timestamp
 *         metadata:
 *           type: object
 *           description: Additional webhook metadata
 */

module.exports = (sequelize) => {
  const WebhookSubscription = sequelize.define('WebhookSubscription', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false
    },
    url: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isUrl: true,
        len: [10, 2048]
      }
    },
    events: {
      type: DataTypes.ARRAY(DataTypes.STRING),
      allowNull: false,
      validate: {
        isValidEvents(value) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('Events must be a non-empty array');
          }
          
          const validEvents = Object.values(config.webhookEvents);
          const invalidEvents = value.filter(event => !validEvents.includes(event));
          
          if (invalidEvents.length > 0) {
            throw new Error(`Invalid events: ${invalidEvents.join(', ')}`);
          }
        }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    secret: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: () => crypto.randomBytes(32).toString('hex')
    },
    retryCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
      validate: {
        min: 0
      }
    },
    maxRetries: {
      type: DataTypes.INTEGER,
      defaultValue: 3,
      allowNull: false,
      validate: {
        min: 0,
        max: 10
      }
    },
    lastSuccessAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastFailureAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastFailureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {},
      allowNull: true
    }
  }, {
    tableName: 'webhook_subscriptions',
    indexes: [
      {
        fields: ['url']
      },
      {
        fields: ['is_active']
      },
      {
        fields: ['events'],
        using: 'gin'
      }
    ]
  });

  // Instance methods
  WebhookSubscription.prototype.isSubscribedTo = function(eventType) {
    return this.events.includes(eventType);
  };

  WebhookSubscription.prototype.generateSignature = function(payload) {
    const hmac = crypto.createHmac('sha256', this.secret);
    hmac.update(payload, 'utf8');
    return `sha256=${hmac.digest('hex')}`;
  };

  WebhookSubscription.prototype.verifySignature = function(payload, signature) {
    const expectedSignature = this.generateSignature(payload);
    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  };

  WebhookSubscription.prototype.recordSuccess = async function() {
    this.lastSuccessAt = new Date();
    this.retryCount = 0;
    this.lastFailureReason = null;
    await this.save();
  };

  WebhookSubscription.prototype.recordFailure = async function(reason) {
    this.lastFailureAt = new Date();
    this.lastFailureReason = reason;
    this.retryCount += 1;
    
    // Disable webhook if max retries exceeded
    if (this.retryCount >= this.maxRetries) {
      this.isActive = false;
    }
    
    await this.save();
  };

  WebhookSubscription.prototype.resetRetries = async function() {
    this.retryCount = 0;
    this.lastFailureReason = null;
    if (!this.isActive) {
      this.isActive = true;
    }
    await this.save();
  };

  WebhookSubscription.prototype.shouldRetry = function() {
    return this.isActive && this.retryCount < this.maxRetries;
  };

  WebhookSubscription.prototype.getNextRetryDelay = function() {
    // Exponential backoff: 1s, 2s, 4s, 8s, etc. (max 60s)
    const delay = Math.min(Math.pow(2, this.retryCount) * 1000, 60000);
    return delay;
  };

  WebhookSubscription.prototype.getHealthStatus = function() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    let status = 'healthy';
    let message = 'Webhook is functioning normally';
    
    if (!this.isActive) {
      status = 'disabled';
      message = 'Webhook is disabled';
    } else if (this.retryCount > 0) {
      status = 'retrying';
      message = `Webhook is retrying (attempt ${this.retryCount}/${this.maxRetries})`;
    } else if (this.lastFailureAt && this.lastFailureAt > dayAgo) {
      status = 'warning';
      message = 'Recent failures detected';
    } else if (!this.lastSuccessAt || this.lastSuccessAt < dayAgo) {
      status = 'inactive';
      message = 'No recent successful deliveries';
    }
    
    return {
      status,
      message,
      lastSuccess: this.lastSuccessAt,
      lastFailure: this.lastFailureAt,
      retryCount: this.retryCount,
      maxRetries: this.maxRetries
    };
  };

  // Class methods
  WebhookSubscription.associate = (models) => {
    // WebhookSubscription can be associated with specific stores if needed
    // For now, we'll keep it simple without associations
  };

  // Class methods for querying
  WebhookSubscription.findActiveForEvent = function(eventType) {
    return this.findAll({
      where: {
        isActive: true,
        events: {
          [sequelize.Sequelize.Op.contains]: [eventType]
        }
      }
    });
  };

  WebhookSubscription.findFailedWebhooks = function() {
    return this.findAll({
      where: {
        retryCount: {
          [sequelize.Sequelize.Op.gt]: 0
        },
        retryCount: {
          [sequelize.Sequelize.Op.lt]: sequelize.col('max_retries')
        },
        isActive: true
      },
      order: [['lastFailureAt', 'ASC']]
    });
  };

  WebhookSubscription.findStaleWebhooks = function(hoursThreshold = 24) {
    const thresholdDate = new Date();
    thresholdDate.setHours(thresholdDate.getHours() - hoursThreshold);
    
    return this.findAll({
      where: {
        isActive: true,
        [sequelize.Sequelize.Op.or]: [
          {
            lastSuccessAt: {
              [sequelize.Sequelize.Op.lt]: thresholdDate
            }
          },
          {
            lastSuccessAt: {
              [sequelize.Sequelize.Op.is]: null
            }
          }
        ]
      }
    });
  };

  return WebhookSubscription;
};