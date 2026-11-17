const round1 = value => Math.round(value * 10) / 10;

const validRating = value => {
  const n = Number(value);
  return Number.isFinite(n) && n >= 1 && n <= 5 ? n : null;
};

/** Average of a numeric field over reviews, ignoring missing/zero values. Null when there is nothing to average. */
const average = (reviews, field) => {
  const values = reviews.map(item => Number(item[field])).filter(n => Number.isFinite(n) && n > 0);
  return values.length ? round1(values.reduce((sum, n) => sum + n, 0) / values.length) : null;
};

/**
 * Makes each listing's stored `rating` and `reviewCount` match its real reviews, so a listing with
 * no reviews always reads 0 / 0 and a seeded or edited counter can never drift from the list.
 * Returns the same db object (listings that already match keep their identity).
 */
const syncReviewStats = db => {
  const byToilet = new Map();
  (db.reviews || []).forEach(review => {
    const rating = validRating(review.rating);
    if (rating === null || !review.toiletId) return;
    if (!byToilet.has(review.toiletId)) byToilet.set(review.toiletId, []);
    byToilet.get(review.toiletId).push(rating);
  });

  db.toilets = (db.toilets || []).map(toilet => {
    const ratings = byToilet.get(toilet.id) || [];
    const count = ratings.length;
    const rating = count ? round1(ratings.reduce((sum, n) => sum + n, 0) / count) : 0;
    if (Number(toilet.rating || 0) === rating && Number(toilet.reviewCount || 0) === count) return toilet;
    return { ...toilet, rating, reviewCount: count };
  });
  return db;
};

/** Per-aspect averages for the details screen; every value is null until a review rates that aspect. */
const ratingBreakdown = reviews => ({
  cleanliness: average(reviews, 'cleanliness'),
  safety: average(reviews, 'safety'),
  facilities: average(reviews, 'facilities'),
  valueForMoney: average(reviews, 'valueForMoney'),
});

module.exports = { syncReviewStats, ratingBreakdown, validRating };
