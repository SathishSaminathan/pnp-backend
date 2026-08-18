const express = require('express');
const { readDb } = require('../store/db');
const { mapReview } = require('../services/uploads');

const router = express.Router();

router.get('/', (req, res) => {
  const { toiletId } = req.query;
  const db = readDb();
  const items = db.reviews
    .filter(review => (!toiletId ? true : review.toiletId === toiletId))
    .map(review => ({
      ...mapReview(review),
      toiletName: db.toilets.find(item => item.id === review.toiletId)?.name || '',
    }));
  res.json(items);
});

module.exports = router;
