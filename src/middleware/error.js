const { HttpError } = require('../utils');

const notFound = (req, _res, next) => {
  next(new HttpError(404, `Route not found: ${req.method} ${req.path}`));
};

const multerMessage = err => {
  if (err.code === 'LIMIT_FILE_SIZE') return 'Each photo must be under 8 MB';
  if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') {
    return 'You can upload up to 4 photos';
  }
  return err.message || 'Could not upload photos';
};

const errorHandler = (err, _req, res, _next) => {
  const isMulter = err.name === 'MulterError';
  const status = err.status || (isMulter ? 400 : 500);
  if (status >= 500) {
    console.error('API error', err);
  }
  res.status(status).json({
    message: isMulter ? multerMessage(err) : err.message || 'Unexpected server error',
    ...(err.code ? { code: err.code } : {}),
  });
};

module.exports = { notFound, errorHandler };
