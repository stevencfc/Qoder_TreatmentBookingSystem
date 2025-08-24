const { Sequelize } = require('sequelize');
const config = require('./index');

// Initialize Sequelize connection
let sequelize;

if (config.database.url) {
  // Use DATABASE_URL if available (production)
  sequelize = new Sequelize(config.database.url, {
    dialect: 'postgres',
    dialectOptions: {
      ssl: config.nodeEnv === 'production' ? {
        require: true,
        rejectUnauthorized: false
      } : false
    },
    logging: config.nodeEnv === 'development' ? console.log : false,
    define: {
      timestamps: true,
      underscored: true,
      underscoredAll: true,
    },
    pool: {
      max: config.nodeEnv === 'production' ? 20 : 10,
      min: config.nodeEnv === 'production' ? 5 : 0,
      acquire: 30000,
      idle: 10000
    }
  });
} else {
  // Use individual database configuration
  sequelize = new Sequelize(
    config.database.name,
    config.database.user,
    config.database.password,
    {
      host: config.database.host,
      port: config.database.port,
      dialect: 'postgres',
      logging: config.nodeEnv === 'development' ? console.log : false,
      define: {
        timestamps: true,
        underscored: true,
        underscoredAll: true,
      },
      pool: {
        max: 10,
        min: 0,
        acquire: 30000,
        idle: 10000
      }
    }
  );
}

// Test the connection
const testConnection = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully.');
  } catch (error) {
    console.error('❌ Unable to connect to the database:', error.message);
    process.exit(1);
  }
};

// Initialize models
const initializeModels = () => {
  // Import all models here
  const User = require('../models/User')(sequelize);
  const Store = require('../models/Store')(sequelize);
  const Treatment = require('../models/Treatment')(sequelize);
  const Booking = require('../models/Booking')(sequelize);
  const Resource = require('../models/Resource')(sequelize);
  const Timeslot = require('../models/Timeslot')(sequelize);
  const WebhookSubscription = require('../models/WebhookSubscription')(sequelize);
  
  // Define associations
  const models = {
    User,
    Store,
    Treatment,
    Booking,
    Resource,
    Timeslot,
    WebhookSubscription
  };
  
  // Set up associations
  Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  });
  
  return models;
};

module.exports = {
  sequelize,
  testConnection,
  initializeModels
};