const express = require('express');
const TreatmentController = require('../controllers/TreatmentController');
const { authenticate, authorize, authorizeStore } = require('../middleware/auth');
const { validateTreatmentCreation, validateTreatmentUpdate, validatePagination } = require('../middleware/validation');
const config = require('../config');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Treatments
 *   description: Treatment management API
 */

/**
 * @swagger
 * /api/v1/treatments:
 *   get:
 *     summary: Get all treatments with filtering
 *     tags: [Treatments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Treatments retrieved successfully
 */
router.get('/', authenticate, validatePagination, TreatmentController.getAllTreatments);

/**
 * @swagger
 * /api/v1/treatments/categories:
 *   get:
 *     summary: Get treatment categories
 *     tags: [Treatments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: storeId
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Treatment categories retrieved successfully
 */
router.get('/categories', authenticate, TreatmentController.getTreatmentCategories);

/**
 * @swagger
 * /api/v1/treatments:
 *   post:
 *     summary: Create new treatment
 *     tags: [Treatments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Treatment'
 *     responses:
 *       201:
 *         description: Treatment created successfully
 */
router.post('/', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN), 
  validateTreatmentCreation, 
  TreatmentController.createTreatment
);

/**
 * @swagger
 * /api/v1/treatments/{treatmentId}:
 *   get:
 *     summary: Get treatment by ID
 *     tags: [Treatments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: treatmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Treatment retrieved successfully
 */
router.get('/:treatmentId', authenticate, TreatmentController.getTreatmentById);

/**
 * @swagger
 * /api/v1/treatments/{treatmentId}:
 *   put:
 *     summary: Update treatment
 *     tags: [Treatments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: treatmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Treatment'
 *     responses:
 *       200:
 *         description: Treatment updated successfully
 */
router.put('/:treatmentId', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN), 
  validateTreatmentUpdate, 
  TreatmentController.updateTreatment
);

/**
 * @swagger
 * /api/v1/treatments/{treatmentId}:
 *   delete:
 *     summary: Delete treatment (deactivate)
 *     tags: [Treatments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: treatmentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Treatment deleted successfully
 */
router.delete('/:treatmentId', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN), 
  TreatmentController.deleteTreatment
);

module.exports = router;