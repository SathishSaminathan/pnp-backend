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

const MIME_FROM_EXT = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  heic: 'image/heic',
  heif: 'image/heif',
};

const mimeFromName = name => {
  const ext = String(name || '')
    .split('.')
    .pop()
    ?.toLowerCase();
  return MIME_FROM_EXT[ext] || '';
};

const isAllowedImage = file => {
  const type = String(file.mimetype || '').toLowerCase();
  if (ALLOWED_TYPES.has(type)) return true;
  if (type.startsWith('image/') && type !== 'image/svg+xml' && type !== 'image/gif') return true;
  if (!type || type === 'application/octet-stream') return Boolean(mimeFromName(file.originalname));
  return false;
};

const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 4 },
  fileFilter: (_req, file, cb) => {
    if (!isAllowedImage(file)) {
      cb(new HttpError(400, 'Only JPEG, PNG, WebP, or HEIC images are allowed'));
      return;
    }
    if (!file.mimetype || file.mimetype === 'application/octet-stream') {
      file.mimetype = mimeFromName(file.originalname) || 'image/jpeg';
    }
    cb(null, true);
  },
});

const collectPhotoFiles = req => {
  const uploaded = req.files;
  if (Array.isArray(uploaded)) return uploaded.filter(Boolean);
  if (uploaded && typeof uploaded === 'object') {
    return Object.values(uploaded)
      .flat()
      .filter(Boolean);
  }
  return [];
};

const parseToiletPhotos = (req, res, next) => {
  if (req.body && Array.isArray(req.body._parts)) {
    next(
      new HttpError(
        400,
        'Photos must be sent as multipart/form-data with field name "photos", not JSON. Do not set Content-Type manually.',
      ),
    );
    return;
  }

  photoUpload.any()(req, res, err => {
    if (err) {
      next(err);
      return;
    }
    req.files = collectPhotoFiles(req);
    next();
  });
};

const parseProfilePhoto = (req, res, next) => {
  if (req.body && Array.isArray(req.body._parts)) {
    next(
      new HttpError(
        400,
        'Photo must be sent as multipart/form-data with field name "photo", not JSON. Do not set Content-Type manually.',
      ),
    );
    return;
  }

  photoUpload.single('photo')(req, res, err => {
    if (err) {
      next(err);
      return;
    }
    req.files = req.file ? [req.file] : [];
    next();
  });
};

module.exports = { photoUpload, parseToiletPhotos, parseProfilePhoto, collectPhotoFiles };
