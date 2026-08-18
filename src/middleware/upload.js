const multer = require('multer');
const { HttpError } = require('../utils');

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
]);

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    const type = String(file.mimetype || '').toLowerCase();
    if (ALLOWED_TYPES.has(type) || (type.startsWith('image/') && type !== 'image/svg+xml' && type !== 'image/gif')) {
      cb(null, true);
      return;
    }
    cb(new HttpError(400, 'Only JPEG, PNG, or WebP images are allowed'));
  },
});

module.exports = { photoUpload };
