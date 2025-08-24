const express = require('express');
const { catchAsync } = require('../middleware/errorHandler');
const { sequelize } = require('../config/database');
const config = require('../config');
const package = require('../../package.json');

const router = express.Router();

/**
 * @swagger
 * /health:
 *   get:
 *     summary: Basic health check
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Uptime in seconds
 */
router.get('/', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: package.version
  });
});

/**
 * @swagger
 * /health/detailed:
 *   get:
 *     summary: Detailed health check with dependencies
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Detailed health status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                 environment:
 *                   type: string
 *                 dependencies:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                         responseTime:
 *                           type: number
 *                 system:
 *                   type: object
 *                   properties:
 *                     memory:
 *                       type: object
 *                     cpu:
 *                       type: object
 *       503:
 *         description: Service unhealthy
 */
router.get('/detailed', catchAsync(async (req, res) => {
  const startTime = Date.now();
  let overallStatus = 'ok';
  const dependencies = {};

  // Check database connection
  try {
    const dbStartTime = Date.now();
    await sequelize.authenticate();
    dependencies.database = {
      status: 'ok',
      responseTime: Date.now() - dbStartTime
    };
  } catch (error) {
    dependencies.database = {
      status: 'error',
      error: error.message
    };
    overallStatus = 'error';
  }

  // Check database tables (basic query)
  try {
    const { User } = sequelize.models;
    await User.count();
    dependencies.database.tables = 'accessible';
  } catch (error) {
    dependencies.database.tables = 'error';
    dependencies.database.tablesError = error.message;
    overallStatus = 'error';
  }

  // System information
  const memoryUsage = process.memoryUsage();
  const system = {
    memory: {
      rss: Math.round(memoryUsage.rss / 1024 / 1024) + ' MB',
      heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
      heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
      external: Math.round(memoryUsage.external / 1024 / 1024) + ' MB'
    },
    cpu: {
      architecture: process.arch,
      platform: process.platform,
      nodeVersion: process.version
    },
    uptime: process.uptime()
  };

  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    responseTime: Date.now() - startTime,
    version: package.version,
    environment: config.nodeEnv,
    dependencies,
    system
  };

  const statusCode = overallStatus === 'ok' ? 200 : 503;
  res.status(statusCode).json(response);
}));

/**
 * @swagger
 * /health/readiness:
 *   get:
 *     summary: Readiness probe for Kubernetes/Docker
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is ready to receive traffic
 *       503:
 *         description: Service is not ready
 */
router.get('/readiness', catchAsync(async (req, res) => {
  try {
    // Check if database is accessible
    await sequelize.authenticate();
    
    // Check if essential tables exist and are accessible
    const { User, Store } = sequelize.models;
    await Promise.all([
      User.count(),
      Store.count()
    ]);

    res.json({
      status: 'ready',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      reason: error.message
    });
  }
}));

/**
 * @swagger
 * /health/liveness:
 *   get:
 *     summary: Liveness probe for Kubernetes/Docker
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service is alive
 */
router.get('/liveness', (req, res) => {
  // Simple liveness check - just ensure the process is running
  res.json({
    status: 'alive',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

/**
 * @swagger
 * /health/metrics:
 *   get:
 *     summary: Application metrics
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Application metrics
 */
router.get('/metrics', catchAsync(async (req, res) => {
  const metrics = {};

  try {
    const { User, Store, Treatment, Booking } = sequelize.models;
    
    // Get basic counts
    const [userCount, storeCount, treatmentCount, bookingCount] = await Promise.all([
      User.count(),
      Store.count(),
      Treatment.count(),
      Booking.count()
    ]);

    metrics.entities = {
      users: userCount,
      stores: storeCount,
      treatments: treatmentCount,
      bookings: bookingCount
    };

    // Get booking statistics for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayBookings = await Booking.count({
      where: {
        bookingDateTime: {
          [sequelize.Sequelize.Op.gte]: today,
          [sequelize.Sequelize.Op.lt]: tomorrow
        }
      }
    });

    const activeBookings = await Booking.count({
      where: {
        status: {
          [sequelize.Sequelize.Op.in]: ['confirmed', 'in_progress']
        }
      }
    });

    metrics.bookings = {
      today: todayBookings,
      active: activeBookings
    };

    // System metrics
    const memoryUsage = process.memoryUsage();
    metrics.system = {
      memory: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external
      },
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    res.json({
      status: 'ok',
      metrics
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}));

module.exports = router;