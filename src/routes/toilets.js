const express = require('express');
const { HttpError } = require('../utils');
const { readDb, updateDb, nextId } = require('../store/db');
const { isToiletEnabled, mapEnabledStatus, mapToilet, listToilets, discoveryFilters } = require('../services/toilets');
const { facilityValues } = require('../services/master');
const { listFavoriteToilets, toggleFavorite } = require('../services/favorites');
const { parseToiletPhotos } = require('../middleware/upload');
const { deletePhotoUrls, normalizePhotoList, uploadToiletPhotos } = require('../services/uploads');

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

router.get('/favorites', (req, res) => {
  res.json(listFavoriteToilets(readDb(), req.user));
});

router.post('/photos', parseToiletPhotos, async (req, res, next) => {
  try {
    const photos = await uploadToiletPhotos({ userId: req.user.id, files: req.files || [] });
    res.status(201).json({ photos });
  } catch (error) {
    next(error);
  }
});

router.get('/:toiletId/bookings', (req, res) => {
  const db = readDb();
  getToiletOrThrow(db, req.params.toiletId);
  res.json(db.bookings.filter(item => item.toiletId === req.params.toiletId));
});

router.patch('/:toiletId/enabled', (req, res, next) => {
  try {
    const { toiletId } = req.params;
    if (typeof req.body?.enabled !== 'boolean') {
      throw new HttpError(400, 'enabled must be a boolean');
    }
    const enabled = req.body.enabled;
    let result;

    updateDb(db => {
      const toilet = getToiletOrThrow(db, toiletId);
      if (toilet.ownerId !== req.user.id) {
        throw new HttpError(403, 'You can only update your own listings');
      }
      db.toilets = db.toilets.map(item => (item.id === toiletId ? { ...item, enabled } : item));
      result = mapEnabledStatus(db.toilets.find(item => item.id === toiletId), enabled);
      return db;
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

router.get('/:toiletId', (req, res, next) => {
  try {
    const db = readDb();
    const toilet = getToiletOrThrow(db, req.params.toiletId);
    if (!isToiletEnabled(toilet) && toilet.ownerId !== req.user.id) {
      throw new HttpError(404, 'Toilet not found');
    }
    res.json(mapToilet(toilet, req.user, db.reviews, undefined, { includeReviews: true }));
  } catch (error) {
    next(error);
  }
});

router.post('/:toiletId/favorite', (req, res, next) => {
  try {
    const { toiletId } = req.params;
    const requested = req.body?.favorite;
    let mapped;

    updateDb(db => {
      const result = toggleFavorite(db, req.user.id, toiletId, requested);
      req.user = result.user;
      mapped = result.toilet;
      return db;
    });

    res.json(mapped);
  } catch (error) {
    next(error);
  }
});

router.delete('/:toiletId/favorite', (req, res, next) => {
  try {
    const { toiletId } = req.params;
    let mapped;

    updateDb(db => {
      const result = toggleFavorite(db, req.user.id, toiletId, false);
      req.user = result.user;
      mapped = result.toilet;
      return db;
    });

    res.json(mapped);
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    const payload = req.body || {};
    const photos = normalizePhotoList(payload.photos, { required: true });
    let created;

    updateDb(db => {
      created = {
        id: nextId('toilet'),
        ownerId: req.user.id,
        rating: 0,
        reviewCount: 0,
        verified: false,
        availability: payload.availability || (db.master?.availability || []).find(item => item.active !== false)?.value || 'AVAILABLE',
        distanceKm: 0,
        priceLabel: 'Per use',
        basePrice: Number(payload.basePrice || 20),
        photos,
        facilities: payload.facilities || facilityValues(db).slice(0, 6),
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
        enabled: payload.enabled !== false,
      };
      db.toilets.unshift(created);
      return db;
    });

    const db = readDb();
    res.status(201).json(mapToilet(created, req.user, db.reviews));
  } catch (error) {
    next(error);
  }
});

router.put('/:toiletId', async (req, res, next) => {
  try {
    const { toiletId } = req.params;
    const payload = { ...(req.body || {}) };
    delete payload.id;
    if (payload.enabled != null) {
      payload.enabled = payload.enabled !== false;
    }
    if (payload.photos) {
      payload.photos = normalizePhotoList(payload.photos, { required: true });
    }

    let removedPhotos = [];
    updateDb(db => {
      const toilet = getToiletOrThrow(db, toiletId);
      if (toilet.ownerId !== req.user.id) {
        throw new HttpError(403, 'You can only update your own listings');
      }
      if (payload.photos) {
        const nextPhotos = new Set(payload.photos);
        removedPhotos = (toilet.photos || []).filter(url => !nextPhotos.has(url));
      }
      db.toilets = db.toilets.map(item =>
        item.id === toiletId ? { ...item, ...payload, id: toiletId, ownerId: item.ownerId, priceLabel: 'Per use' } : item,
      );
      return db;
    });

    if (removedPhotos.length) {
      await deletePhotoUrls(removedPhotos);
    }

    const db = readDb();
    res.json(mapToilet(getToiletOrThrow(db, toiletId), req.user, db.reviews));
  } catch (error) {
    next(error);
  }
});

module.exports = router;
