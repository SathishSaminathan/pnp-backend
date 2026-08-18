const { HttpError } = require('../utils');

const normalizeDeviceToken = value => String(value == null ? '' : value).trim();

const setUserDeviceToken = (db, userId, deviceToken) => {
  const user = db.users.find(item => item.id === userId);
  if (!user) {
    throw new HttpError(401, 'Invalid session');
  }

  const nextToken = normalizeDeviceToken(deviceToken);
  const updatedAt = new Date().toISOString();

  db.users = db.users.map(item => {
    if (item.id === userId) {
      return {
        ...item,
        deviceToken: nextToken,
        deviceTokenUpdatedAt: nextToken ? updatedAt : null,
      };
    }
    if (nextToken && item.deviceToken === nextToken) {
      return { ...item, deviceToken: '', deviceTokenUpdatedAt: updatedAt };
    }
    return item;
  });

  return db.users.find(item => item.id === userId);
};

module.exports = { normalizeDeviceToken, setUserDeviceToken };
