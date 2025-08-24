const { catchAsync, AppError, NotFoundError, AuthorizationError } = require('../middleware/errorHandler');
const { sequelize } = require('../config/database');
const logger = require('../utils/logger');
const config = require('../config');
const axios = require('axios');
const crypto = require('crypto');

class WebhookController {
  /**
   * Create webhook subscription
   */
  static createSubscription = catchAsync(async (req, res) => {
    const { url, events, maxRetries = 3, metadata } = req.body;

    // Only super admins can create webhook subscriptions
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can create webhook subscriptions');
    }

    const subscription = await sequelize.models.WebhookSubscription.create({
      url,
      events,
      maxRetries,
      metadata,
      isActive: true
    });

    logger.logWebhookEvent('subscription_created', subscription.id, null, {
      url: subscription.url,
      events: subscription.events,
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      data: subscription.toJSON()
    });
  });

  /**
   * Get all webhook subscriptions
   */
  static getAllSubscriptions = catchAsync(async (req, res) => {
    const { page = 1, limit = 10, isActive } = req.query;

    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can view webhook subscriptions');
    }

    const where = {};
    if (isActive !== undefined) where.isActive = isActive === 'true';

    const offset = (page - 1) * limit;

    const { count, rows: subscriptions } = await sequelize.models.WebhookSubscription.findAndCountAll({
      where,
      limit: parseInt(limit),
      offset,
      order: [['createdAt', 'DESC']]
    });

    // Add health status to each subscription
    const subscriptionsWithHealth = subscriptions.map(sub => {
      const subData = sub.toJSON();
      subData.healthStatus = sub.getHealthStatus();
      return subData;
    });

    res.json({
      success: true,
      data: subscriptionsWithHealth,
      meta: {
        page: parseInt(page),
        pageSize: parseInt(limit),
        totalCount: count,
        totalPages: Math.ceil(count / limit)
      }
    });
  });

  /**
   * Get webhook subscription by ID
   */
  static getSubscriptionById = catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;

    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can view webhook subscriptions');
    }

    const subscription = await sequelize.models.WebhookSubscription.findByPk(subscriptionId);
    if (!subscription) {
      throw new NotFoundError('Webhook subscription');
    }

    const subscriptionData = subscription.toJSON();
    subscriptionData.healthStatus = subscription.getHealthStatus();

    res.json({
      success: true,
      data: subscriptionData
    });
  });

  /**
   * Update webhook subscription
   */
  static updateSubscription = catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;
    const updates = req.body;

    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can update webhook subscriptions');
    }

    const subscription = await sequelize.models.WebhookSubscription.findByPk(subscriptionId);
    if (!subscription) {
      throw new NotFoundError('Webhook subscription');
    }

    await subscription.update(updates);

    logger.logWebhookEvent('subscription_updated', subscriptionId, null, {
      updates,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      data: subscription.toJSON()
    });
  });

  /**
   * Delete webhook subscription
   */
  static deleteSubscription = catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;

    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can delete webhook subscriptions');
    }

    const subscription = await sequelize.models.WebhookSubscription.findByPk(subscriptionId);
    if (!subscription) {
      throw new NotFoundError('Webhook subscription');
    }

    await subscription.destroy();

    logger.logWebhookEvent('subscription_deleted', subscriptionId, null, {
      deletedBy: req.user.id
    });

    res.json({
      success: true,
      data: { message: 'Webhook subscription deleted successfully' }
    });
  });

  /**
   * Test webhook subscription
   */
  static testSubscription = catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;

    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can test webhook subscriptions');
    }

    const subscription = await sequelize.models.WebhookSubscription.findByPk(subscriptionId);
    if (!subscription) {
      throw new NotFoundError('Webhook subscription');
    }

    // Create test payload
    const testPayload = {
      eventType: 'test.webhook',
      timestamp: new Date().toISOString(),
      data: {
        message: 'This is a test webhook payload',
        subscriptionId: subscription.id,
        testedBy: req.user.id
      }
    };

    try {
      const result = await WebhookController.sendWebhook(subscription, testPayload);
      
      logger.logWebhookEvent('test_webhook_sent', subscriptionId, 'test.webhook', {
        success: result.success,
        responseTime: result.responseTime,
        testedBy: req.user.id
      });

      res.json({
        success: true,
        data: {
          message: 'Test webhook sent successfully',
          result
        }
      });
    } catch (error) {
      logger.logWebhookEvent('test_webhook_failed', subscriptionId, 'test.webhook', {
        error: error.message,
        testedBy: req.user.id
      });

      res.status(400).json({
        success: false,
        data: {
          message: 'Test webhook failed',
          error: error.message
        }
      });
    }
  });

  /**
   * Send webhook to a subscription
   */
  static async sendWebhook(subscription, payload) {
    const startTime = Date.now();
    
    try {
      const payloadString = JSON.stringify(payload);
      const signature = subscription.generateSignature(payloadString);
      
      const response = await axios.post(subscription.url, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Signature': signature,
          'X-Timestamp': Math.floor(Date.now() / 1000).toString(),
          'User-Agent': 'TreatmentBookingSystem-Webhook/1.0'
        },
        timeout: 30000 // 30 seconds timeout
      });

      const responseTime = Date.now() - startTime;

      // Record success
      await subscription.recordSuccess();

      return {
        success: true,
        statusCode: response.status,
        responseTime,
        response: response.data
      };
    } catch (error) {
      const responseTime = Date.now() - startTime;
      
      // Record failure
      await subscription.recordFailure(error.message);

      return {
        success: false,
        error: error.message,
        responseTime,
        statusCode: error.response?.status || null
      };
    }
  }

  /**
   * Trigger webhook for an event
   */
  static async triggerWebhooks(eventType, data) {
    try {
      const subscriptions = await sequelize.models.WebhookSubscription.findActiveForEvent(eventType);
      
      if (subscriptions.length === 0) {
        return { sent: 0, failed: 0 };
      }

      const payload = {
        eventType,
        timestamp: new Date().toISOString(),
        data
      };

      let sent = 0;
      let failed = 0;

      const promises = subscriptions.map(async (subscription) => {
        try {
          const result = await WebhookController.sendWebhook(subscription, payload);
          if (result.success) {
            sent++;
          } else {
            failed++;
          }
          
          logger.logWebhookEvent('webhook_triggered', subscription.id, eventType, {
            success: result.success,
            responseTime: result.responseTime
          });
        } catch (error) {
          failed++;
          logger.logError(error, {
            context: 'webhook_trigger',
            subscriptionId: subscription.id,
            eventType
          });
        }
      });

      await Promise.all(promises);

      return { sent, failed };
    } catch (error) {
      logger.logError(error, {
        context: 'trigger_webhooks',
        eventType
      });
      return { sent: 0, failed: 0 };
    }
  }

  /**
   * Get webhook delivery logs
   */
  static getDeliveryLogs = catchAsync(async (req, res) => {
    const { subscriptionId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can view webhook logs');
    }

    // This would typically query a webhook_deliveries table
    // For now, we'll return a placeholder response
    res.json({
      success: true,
      data: {
        message: 'Webhook delivery logs - Implementation pending',
        subscriptionId,
        note: 'This feature requires a separate webhook_deliveries table to track delivery attempts'
      }
    });
  });

  /**
   * Retry failed webhooks
   */
  static retryFailedWebhooks = catchAsync(async (req, res) => {
    if (req.user.role !== config.roles.SUPER_ADMIN) {
      throw new AuthorizationError('Only super admins can retry failed webhooks');
    }

    const failedWebhooks = await sequelize.models.WebhookSubscription.findFailedWebhooks();
    
    let retried = 0;
    let stillFailed = 0;

    for (const webhook of failedWebhooks) {
      if (webhook.shouldRetry()) {
        // In a real implementation, you would re-send the failed webhook
        // For now, we'll just reset the retry count
        await webhook.resetRetries();
        retried++;
      } else {
        stillFailed++;
      }
    }

    res.json({
      success: true,
      data: {
        message: 'Retry operation completed',
        retried,
        stillFailed,
        totalProcessed: failedWebhooks.length
      }
    });
  });
}

module.exports = WebhookController;