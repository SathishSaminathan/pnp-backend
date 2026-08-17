const express = require('express');
const { FACILITIES } = require('../constants');
const { HttpError } = require('../utils');
const { readDb, updateDb, nextId } = require('../store/db');
const { mapToilet, listToilets, discoveryFilters } = require('../services/toilets');

const router = express.Router();

const getToiletOrThrow = (db, toiletId) => {
  const toilet = db.toilets.find(item => item.id === toiletId);
  if (!toilet) {
    throw new HttpError(404, 'Toilet not found');
  }
  return toilet;
};

router.post('/search', (req, res) => {
  const payload = typeof req.body === 'string' ? { search: req.body } : req.body || {};
  const db = readDb();
  res.json(listToilets({ db, user: req.user, ...payload }));
});

router.get('/filters', (_req, res) => {
  res.json(discoveryFilters(readDb()));
});

router.get('/mine', (req, res) => {
  const db = readDb();
  const toilets = db.toilets
    .filter(item => item.ownerId === req.user.id)
    .map(item => mapToilet(item, req.user, db.reviews));
  res.json(toilets);
});

router.get('/:toiletId/bookings', (req, res) => {
  const db = readDb();
  getToiletOrThrow(db, req.params.toiletId);
  res.json(db.bookings.filter(item => item.toiletId === req.params.toiletId));
});

router.get('/:toiletId', (req, res, next) => {
  try {
    const db = readDb();
    const toilet = getToiletOrThrow(db, req.params.toiletId);
    res.json(mapToilet(toilet, req.user, db.reviews));
  } catch (error) {
    next(error);
  }
});

router.post('/:toiletId/favorite', (req, res, next) => {
  try {
    const { toiletId } = req.params;
    let mapped;

    updateDb(db => {
      getToiletOrThrow(db, toiletId);
      db.users = db.users.map(item => {
        if (item.id !== req.user.id) return item;
        const favorites = item.favoriteToiletIds || [];
        const nextFavorites = favorites.includes(toiletId)
          ? favorites.filter(id => id !== toiletId)
          : [...favorites, toiletId];
        req.user = { ...item, favoriteToiletIds: nextFavorites };
        return req.user;
      });
      mapped = mapToilet(getToiletOrThrow(db, toiletId), req.user, db.reviews);
      return db;
    });

    res.json(mapped);
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res) => {
  const payload = req.body || {};
  let created;

  updateDb(db => {
    created = {
      id: nextId('toilet'),
      ownerId: req.user.id,
      rating: 0,
      reviewCount: 0,
      verified: false,
      availability: payload.availability || 'AVAILABLE',
      distanceKm: 0,
      priceLabel: 'Per use',
      basePrice: Number(payload.basePrice || 20),
      photos: payload.photos || ['https://picsum.photos/seed/pnp-new-toilet/800/500'],
      facilities: payload.facilities || FACILITIES.slice(0, 6),
      coordinates: payload.coordinates || { latitude: 13.05, longitude: 80.27 },
      address: payload.address || {
        line1: 'Added Address',
        area: 'Adyar',
        city: req.user.city || 'Chennai',
        state: 'Tamil Nadu',
        country: 'India',
        postalCode: '600020',
      },
      operatingHours: payload.operatingHours || '06:00 AM - 10:00 PM',
      name: payload.name,
      description: payload.description,
      category: payload.category || 'Premium',
    };
    db.toilets.unshift(created);
    return db;
  });

  const db = readDb();
  res.status(201).json(mapToilet(created, req.user, db.reviews));
});

router.put('/:toiletId', (req, res, next) => {
  try {
    const { toiletId } = req.params;
    const payload = { ...(req.body || {}) };
    delete payload.id;

    updateDb(db => {
      const toilet = getToiletOrThrow(db, toiletId);
      if (toilet.ownerId !== req.user.id) {
        throw new HttpError(403, 'You can only update your own listings');
      }
      db.toilets = db.toilets.map(item =>
        item.id === toiletId ? { ...item, ...payload, id: toiletId, ownerId: item.ownerId, priceLabel: 'Per use' } : item,
      );
      return db;
    });

    const db = readDb();
    res.json(mapToilet(getToiletOrThrow(db, toiletId), req.user, db.reviews));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
