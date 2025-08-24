const { NotFoundError } = require('./errorHandler');

const notFoundHandler = (req, res, next) => {
  const message = `Cannot ${req.method} ${req.originalUrl}`;
  next(new NotFoundError(message));
};

module.exports = notFoundHandler;