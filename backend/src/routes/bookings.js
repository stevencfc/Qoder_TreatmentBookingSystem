const express = require('express');
const BookingController = require('../controllers/BookingController');
const { authenticate, authorize } = require('../middleware/auth');
const { validateBookingCreation, validateBookingUpdate, validatePagination } = require('../middleware/validation');
const config = require('../config');

const router = express.Router();

/**
 * @swagger
 * tags:
 *   name: Bookings
 *   description: Booking management API
 */

/**
 * @swagger
 * /api/v1/bookings:
 *   get:
 *     summary: Get all bookings with filtering
 *     tags: [Bookings]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, confirmed, in_progress, completed, cancelled, no_show]
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *           format: uuid
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *     responses:
 *       200:
 *         description: Bookings retrieved successfully
 */
router.get('/', authenticate, validatePagination, BookingController.getAllBookings);

/**
 * @swagger
 * /api/v1/bookings:
 *   post:
 *     summary: Create new booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Booking'
 *     responses:
 *       201:
 *         description: Booking created successfully
 */
router.post('/', authenticate, validateBookingCreation, BookingController.createBooking);

/**
 * @swagger
 * /api/v1/bookings/{bookingId}:
 *   get:
 *     summary: Get booking by ID
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Booking retrieved successfully
 */
router.get('/:bookingId', authenticate, BookingController.getBookingById);

/**
 * @swagger
 * /api/v1/bookings/{bookingId}:
 *   put:
 *     summary: Update booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Booking'
 *     responses:
 *       200:
 *         description: Booking updated successfully
 */
router.put('/:bookingId', authenticate, validateBookingUpdate, BookingController.updateBooking);

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/cancel:
 *   patch:
 *     summary: Cancel booking
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cancellationReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Booking cancelled successfully
 */
router.patch('/:bookingId/cancel', authenticate, BookingController.cancelBooking);

/**
 * @swagger
 * /api/v1/bookings/{bookingId}/status:
 *   patch:
 *     summary: Update booking status
 *     tags: [Bookings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: bookingId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [pending, confirmed, in_progress, completed, cancelled, no_show]
 *     responses:
 *       200:
 *         description: Booking status updated successfully
 */
router.patch('/:bookingId/status', 
  authenticate, 
  authorize(config.roles.SUPER_ADMIN, config.roles.STORE_ADMIN, config.roles.STAFF), 
  BookingController.updateBookingStatus
);

module.exports = router;