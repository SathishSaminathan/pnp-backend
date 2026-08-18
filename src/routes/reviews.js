const express = require('express');
const { mapReview } = require('../services/uploads');
const { readDb } = require('../store/db');

const router = express.Router();

const sameId = (left, right) =>
  left != null && right != null && String(left) === String(right);

const asObject = value => {
  if (!value || typeof value === 'object') return value || null;
  if (typeof value !== 'string') return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const reviewerId = (review, db) => {
  const direct = review?.userId || review?.user_id || review?.user?.id;
  if (direct) return String(direct);
  const bookingId = review?.bookingId || review?.booking_id;
  if (!bookingId) return null;
  const booking = (db.bookings || []).find(item => sameId(item.id, bookingId));
  const fromBooking = booking?.userId || booking?.user_id;
  return fromBooking ? String(fromBooking) : null;
};

const reviewToiletId = review => review?.toiletId || review?.toilet_id || null;

const serializeReview = (review, db) => ({
  ...mapReview(review),
  userId: reviewerId(review, db),
  toiletId: reviewToiletId(review),
  toiletName: (db.toilets || []).find(item => sameId(item.id, reviewToiletId(review)))?.name || '',
});

router.get('/', (req, res) => {
  const toiletId = String(req.query.toiletId || '').trim();
  const scope = String(req.query.scope || (toiletId ? '' : 'given'))
    .trim()
    .toLowerCase();
  const db = readDb();
  const userId = String(req.user.id);
  const ownedToiletIds = new Set(
    (db.toilets || [])
      .filter(item => sameId(item.ownerId || item.owner_id, userId))
      .map(item => String(item.id)),
  );

  const reviews = (db.reviews || []).map(asObject).filter(Boolean);

  let items;
  if (toiletId) {
    items = reviews.filter(review => sameId(reviewToiletId(review), toiletId));
  } else if (scope === 'received') {
    items = reviews.filter(review => {
      const toilet = reviewToiletId(review);
      if (!toilet || !ownedToiletIds.has(String(toilet))) return false;
      return reviewerId(review, db) !== userId;
    });
  } else {
    items = reviews.filter(review => reviewerId(review, db) === userId);
  }

  res.json(items.map(review => serializeReview(review, db)));
});

module.exports = router;
