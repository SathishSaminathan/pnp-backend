const express = require('express');
const config = require('../config');
const { HttpError, publicUser } = require('../utils');
const { readDb, updateDb } = require('../store/db');
const { signAdminToken, safeEqual, adminProfile, requireAdmin } = require('../middleware/auth');
const { ownerIds, enrichUser, enrichOwner, overview } = require('../services/admin');
const { adminMaster, assertKey, normalizeItem } = require('../services/master');

const router = express.Router();

router.post('/login', (req, res, next) => {
  try {
    const email = String(req.body?.email || req.body?.username || '').toLowerCase().trim();
    const password = String(req.body?.password || '');

    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required');
    }
    if (!safeEqual(email, config.adminEmail) || !safeEqual(password, config.adminPassword)) {
      throw new HttpError(400, 'Invalid credentials');
    }

    const admin = adminProfile();
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token: signAdminToken(admin),
        userData: admin,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.use(requireAdmin);

router.get('/me', (req, res) => {
  res.json({ success: true, data: { data: req.admin } });
});

router.get('/overview', (_req, res) => {
  res.json(overview(readDb()));
});

router.get('/users', (req, res) => {
  const db = readDb();
  const search = String(req.query.search || '').trim().toLowerCase();
  const items = db.users
    .map(user => enrichUser(user, db))
    .filter(user => {
      if (!search) return true;
      return [user.name, user.phone, user.city, user.role].some(value =>
        String(value || '').toLowerCase().includes(search),
      );
    });
  res.json({ items, total: items.length });
});

const setUserBlocked = (req, res, next) => {
  try {
    const blocked = Boolean(req.body?.blocked);
    const reason = String(req.body?.reason || '').trim();
    let saved;

    updateDb(db => {
      const user = db.users.find(item => item.id === req.params.userId);
      if (!user) throw new HttpError(404, 'User not found');
      db.users = db.users.map(item => {
        if (item.id !== req.params.userId) return item;
        saved = {
          ...item,
          blocked,
          blockedAt: blocked ? new Date().toISOString() : null,
          blockedReason: blocked ? reason : '',
        };
        return saved;
      });
      return db;
    });

    res.json(enrichUser(saved, readDb()));
  } catch (error) {
    next(error);
  }
};

router.patch('/users/:userId/block', setUserBlocked);
router.put('/users/:userId/block', setUserBlocked);
router.post('/users/:userId/block', setUserBlocked);

router.get('/users/:userId', (req, res, next) => {
  try {
    const db = readDb();
    const user = db.users.find(item => item.id === req.params.userId);
    if (!user) throw new HttpError(404, 'User not found');
    res.json({
      ...enrichUser(user, db),
      bookings: db.bookings.filter(item => item.userId === user.id),
      favorites: db.toilets.filter(item => (user.favoriteToiletIds || []).includes(item.id)),
      toilets: db.toilets.filter(item => item.ownerId === user.id),
    });
  } catch (error) {
    next(error);
  }
});

router.get('/owners', (req, res) => {
  const db = readDb();
  const ids = ownerIds(db);
  const search = String(req.query.search || '').trim().toLowerCase();
  const items = db.users
    .filter(user => ids.has(user.id))
    .map(user => enrichOwner(user, db))
    .filter(user => {
      if (!search) return true;
      return [user.name, user.phone, user.city].some(value => String(value || '').toLowerCase().includes(search));
    });
  res.json({ items, total: items.length });
});

router.get('/listings', (req, res) => {
  const db = readDb();
  const ownerId = req.query.ownerId;
  const search = String(req.query.search || '').trim().toLowerCase();
  const items = db.toilets
    .filter(item => (!ownerId ? true : item.ownerId === ownerId))
    .map(toilet => {
      const owner = db.users.find(user => user.id === toilet.ownerId) || {
        id: toilet.ownerId,
        phone: '',
        name: 'Unknown',
        city: '',
        profileCompleted: false,
        favoriteToiletIds: [],
      };
      return {
        ...toilet,
        owner: publicUser(owner),
        ownerBlocked: Boolean(owner.blocked),
        bookingCount: db.bookings.filter(item => item.toiletId === toilet.id).length,
      };
    })
    .filter(item => {
      if (!search) return true;
      return [item.name, item.owner?.name, item.owner?.phone, item.address?.city, item.address?.area]
        .some(value => String(value || '').toLowerCase().includes(search));
    });
  res.json({ items, total: items.length });
});

router.get('/bookings', (req, res) => {
  const db = readDb();
  const status = req.query.status;
  const items = db.bookings
    .filter(item => (!status ? true : item.bookingStatus === status))
    .map(booking => ({
      ...booking,
      user: publicUser(db.users.find(user => user.id === booking.userId) || { id: booking.userId, phone: '', name: 'Unknown', city: '', profileCompleted: false, favoriteToiletIds: [] }),
    }));
  res.json({ items, total: items.length });
});

router.get('/earnings', (_req, res) => {
  const db = readDb();
  res.json(overview(db).earnings);
});

router.get('/transactions', (_req, res) => {
  const db = readDb();
  const items = db.transactions.map(txn => ({
    ...txn,
    owner: publicUser(db.users.find(user => user.id === txn.ownerId) || { id: txn.ownerId, phone: '', name: 'Unknown', city: '', profileCompleted: false, favoriteToiletIds: [] }),
  }));
  res.json({ items, total: items.length });
});

router.get('/reviews', (_req, res) => {
  const db = readDb();
  const items = db.reviews.map(review => ({
    ...review,
    toiletName: db.toilets.find(item => item.id === review.toiletId)?.name || '',
  }));
  res.json({ items, total: items.length });
});

router.get('/master', (_req, res) => {
  res.json(adminMaster(readDb()));
});

router.post('/master/:type', (req, res, next) => {
  try {
    const { type } = req.params;
    assertKey(type);
    let created;

    updateDb(db => {
      const list = db.master[type] || [];
      created = normalizeItem(type, { ...req.body, sortOrder: req.body?.sortOrder || list.length + 1 });
      if (list.some(item => item.value.toLowerCase() === created.value.toLowerCase())) {
        throw new HttpError(400, 'That value already exists');
      }
      db.master[type] = [...list, created];
      return db;
    });

    res.status(201).json(created);
  } catch (error) {
    next(error);
  }
});

router.put('/master/:type/:id', (req, res, next) => {
  try {
    const { type, id } = req.params;
    assertKey(type);
    let saved;

    updateDb(db => {
      const list = db.master[type] || [];
      const current = list.find(item => item.id === id);
      if (!current) throw new HttpError(404, 'Master item not found');
      saved = normalizeItem(type, req.body || {}, current);
      if (list.some(item => item.id !== id && item.value.toLowerCase() === saved.value.toLowerCase())) {
        throw new HttpError(400, 'That value already exists');
      }
      db.master[type] = list.map(item => (item.id === id ? saved : item));
      return db;
    });

    res.json(saved);
  } catch (error) {
    next(error);
  }
});

router.delete('/master/:type/:id', (req, res, next) => {
  try {
    const { type, id } = req.params;
    assertKey(type);
    updateDb(db => {
      const list = db.master[type] || [];
      if (!list.some(item => item.id === id)) {
        throw new HttpError(404, 'Master item not found');
      }
      db.master[type] = list.filter(item => item.id !== id);
      return db;
    });
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
