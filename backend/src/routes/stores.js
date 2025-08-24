const express = require('express');
const StoreController = require('../controllers/StoreController');
const AvailabilityController = require('../controllers/AvailabilityController');
const QuotaController = require('../controllers/QuotaController');
const { authenticate, authorize, authorizeStore } = require('../middleware/auth');
const { validateStoreCreation, validateStoreUpdate, validatePagination } = require('../middleware/validation');
const config = require('../config');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Stores
 *   description: Store management API
 */

// Store CRUD routes
router.get('/', authenticate, validatePagination, StoreController.getAllStores);
router.post('/', authenticate, authorize(config.roles.SUPER_ADMIN), validateStoreCreation, StoreController.createStore);
router.get('/:storeId', authenticate, StoreController.getStoreById);
router.put('/:storeId', authenticate, validateStoreUpdate, StoreController.updateStore);
router.put('/:storeId/hours', authenticate, StoreController.updateOperatingHours);
router.get('/:storeId/availability', authenticate, StoreController.getStoreAvailability);

// Availability management routes
router.get('/availability/check', authenticate, AvailabilityController.checkAvailability);
router.get('/availability/slots', authenticate, AvailabilityController.getAvailableSlots);
router.get('/availability/summary', authenticate, AvailabilityController.getAvailabilitySummary);
router.get('/availability/staff', authenticate, AvailabilityController.getAvailableStaff);
router.post('/:storeId/timeslots/generate', authenticate, authorize(config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN), AvailabilityController.generateTimeslots);
router.post('/:storeId/timeslots/bulk-generate', authenticate, authorize(config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN), AvailabilityController.bulkGenerateTimeslots);

// Quota management routes
router.get('/quota/check', authenticate, QuotaController.checkBookingQuota);
router.get('/quota/utilization', authenticate, QuotaController.getQuotaUtilization);
router.get('/quota/peak-hours', authenticate, QuotaController.getPeakHoursAnalysis);
router.get('/quota/forecast', authenticate, QuotaController.getCapacityForecast);
router.get('/:storeId/quota/settings', authenticate, QuotaController.getQuotaSettings);
router.put('/:storeId/quota/settings', authenticate, authorize(config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN), QuotaController.updateQuotaSettings);

module.exports = router;