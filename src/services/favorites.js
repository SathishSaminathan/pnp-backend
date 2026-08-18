const { HttpError } = require('../utils');

const mapToilet = (...args) => require('./toilets').mapToilet(...args);

const favoriteIdsFor = user => {
  const ids = user?.favoriteToiletIds;
  return Array.isArray(ids) ? ids.filter(Boolean) : [];
};

const isFavorite = (user, toiletId) => favoriteIdsFor(user).includes(toiletId);

const listFavoriteToilets = (db, user) => {
  const ids = favoriteIdsFor(user);
  return ids
    .map(id => db.toilets.find(item => item.id === id))
    .filter(toilet => {
      if (!toilet || toilet.enabled === false) return false;
      const owner = db.users.find(item => item.id === toilet.ownerId);
      return !owner?.blocked;
    })
    .map(toilet => mapToilet(toilet, user, db.reviews));
};

const setFavorite = (db, userId, toiletId, shouldFavorite) => {
  const toilet = db.toilets.find(item => item.id === toiletId);
  if (!toilet) {
    throw new HttpError(404, 'Toilet not found');
  }

  let nextUser = null;
  db.users = db.users.map(item => {
    if (item.id !== userId) return item;
    const current = favoriteIdsFor(item);
    const already = current.includes(toiletId);
    const nextIds = shouldFavorite
      ? already
        ? current
        : [...current, toiletId]
      : current.filter(id => id !== toiletId);
    nextUser = { ...item, favoriteToiletIds: nextIds };
    return nextUser;
  });

  if (!nextUser) {
    throw new HttpError(401, 'Invalid session');
  }

  return {
    user: nextUser,
    toilet: mapToilet(toilet, nextUser, db.reviews),
    isFavorite: isFavorite(nextUser, toiletId),
  };
};

const toggleFavorite = (db, userId, toiletId, favorite) => {
  const user = db.users.find(item => item.id === userId);
  if (!user) {
    throw new HttpError(401, 'Invalid session');
  }
  const nextValue = typeof favorite === 'boolean' ? favorite : !isFavorite(user, toiletId);
  return setFavorite(db, userId, toiletId, nextValue);
};

module.exports = {
  favoriteIdsFor,
  isFavorite,
  listFavoriteToilets,
  setFavorite,
  toggleFavorite,
};
