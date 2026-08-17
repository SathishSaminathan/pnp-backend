const jwt = require('jsonwebtoken');
const config = require('../config');
const { HttpError } = require('../utils');
const { readDb } = require('../store/db');

const signAccessToken = user =>
  jwt.sign({ sub: user.id, phone: user.phone }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });

const signRefreshToken = user =>
  jwt.sign({ sub: user.id, type: 'refresh' }, config.jwtSecret, { expiresIn: config.refreshExpiresIn });

const requireAuth = (req, _res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
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

module.exports = {
  signAccessToken,
  signRefreshToken,
  requireAuth,
};
