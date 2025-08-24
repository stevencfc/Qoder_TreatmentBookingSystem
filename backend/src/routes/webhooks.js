const express = require('express');
const WebhookController = require('../controllers/WebhookController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateWebhookSubscription, validateWebhookUpdate } = require('../middleware/validation');
const config = require('../config');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Webhooks
 *   description: Webhook management API
 */

// Webhook subscription management (admin only)
router.get('/', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN), 
  WebhookController.getAllSubscriptions
);

router.post('/', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN), 
  validateWebhookSubscription, 
  WebhookController.createSubscription
);

router.get('/:subscriptionId', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN), 
  WebhookController.getSubscriptionById
);

router.put('/:subscriptionId', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN), 
  validateWebhookUpdate, 
  WebhookController.updateSubscription
);

router.delete('/:subscriptionId', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN), 
  WebhookController.deleteSubscription
);

// Webhook testing and management
router.post('/:subscriptionId/test', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN), 
  WebhookController.testSubscription
);

router.get('/:subscriptionId/logs', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN), 
  WebhookController.getDeliveryLogs
);

router.post('/retry-failed', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN), 
  WebhookController.retryFailedWebhooks
);

module.exports = router;