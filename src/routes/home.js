const express = require('express');
const { readDb } = require('../store/db');
const { listToilets } = require('../services/toilets');
const { listFavoriteToilets } = require('../services/favorites');

const router = express.Router();

router.post('/feed', (req, res) => {
  const payload = typeof req.body === 'string' ? { search: req.body } : req.body || {};
  const db = readDb();
  const filtered = listToilets({ db, user: req.user, ...payload });

  res.json({
    nearbyToilets: filtered.slice(0, 4),
    favoriteToilets: listFavoriteToilets(db, req.user),
    recentSearches: ['Central Station', 'Marina Beach', 'OMR'],
  });
});

module.exports = router;
