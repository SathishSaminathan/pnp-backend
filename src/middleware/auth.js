const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../utils');
const { readDb } = require('../store/db');

const signAccessToken = user =>
  jwt.sign({ sub: user.id, phone: user.phone }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const signRefreshToken = user =>
  jwt.sign({ sub: user.id, type: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshExpiresIn });

const signAdminToken = admin =>
  jwt.sign({ sub: admin.id, role: 'admin', email: admin.email }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const readBearer = req => {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7) : header;
};

const safeEqual = (left, right) => {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
};

const adminProfile = () => ({
  id: 'admin_001',
  userId: 'admin_001',
  email: config.adminEmail,
  firstName: 'PNP',
  lastName: 'Admin',
  name: 'PNP Admin',
  role: 'admin',
});

const requireAuth = (req, _res, next) => {
  const token = readBearer(req);
  if (!token) {
    return next(new HttpError(401, 'Authentication required'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const db = readDb();
    const user = db.users.find(item => item.id === payload.sub);
    if (!user) {
      return next(new HttpError(401, 'Invalid session'));
    }
    req.user = user;
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
};

const requireAdmin = (req, _res, next) => {
  const token = readBearer(req);
  if (!token) {
    return next(new HttpError(401, 'Authentication required'));
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'admin') {
      return next(new HttpError(403, 'Admin access required'));
    }
    req.admin = adminProfile();
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired token'));
  }
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  signAdminToken,
  safeEqual,
  adminProfile,
  requireAuth,
  requireAdmin,
};
