const { HttpError } = require('../utils');

const notFound = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
};

const errorHandler = (err, _req, res, _next) => {
  const status = err.status || 500;
  res.status(status).json({
    message: err.message || 'Unexpected server error',
  });
};

module.exports = { notFound, errorHandler };
