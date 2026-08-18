const express = require('express');
const { mapReview } = require('../services/uploads');
const { readDb } = require('../store/db');

const router = express.Router();

const reviewerId = (review, db) => {
  if (review?.userId) return review.userId;
  if (!review?.bookingId) return null;
  return db.bookings.find(item => item.id === review.bookingId)?.userId || null;
};

const serializeReview = (review, db) => ({
  ...mapReview(review),
  userId: reviewerId(review, db),
  toiletName: db.toilets.find(item => item.id === review.toiletId)?.name || '',
});

router.get('/', (req, res) => {
  const toiletId = String(req.query.toiletId || '').trim();
  const scope = String(req.query.scope || '').trim().toLowerCase();
  const db = readDb();
  const userId = req.user.id;
  const ownedToiletIds = new Set(
    db.toilets.filter(item => item.ownerId === userId).map(item => item.id),
  );

  let items = db.reviews;

  if (toiletId) {
    items = items.filter(review => review.toiletId === toiletId);
  } else if (scope === 'given') {
    items = items.filter(review => reviewerId(review, db) === userId);
  } else if (scope === 'received') {
    items = items.filter(
      review => ownedToiletIds.has(review.toiletId) && reviewerId(review, db) !== userId,
    );
  } else {
    items = items.filter(
      review => reviewerId(review, db) === userId || ownedToiletIds.has(review.toiletId),
    );
  }

  res.json(items.map(review => serializeReview(review, db)));
});

module.exports = router;
