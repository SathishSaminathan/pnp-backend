const express = require('express');
const { BOOKING_STATUS } = require('../constants');
const { HttpError } = require('../utils');
const { readDb, updateDb, nextId } = require('../store/db');
const { mapToilet } = require('../services/toilets');

const router = express.Router();

router.get('/', (req, res) => {
  const status = req.query.status;
  const db = readDb();
  const items = db.bookings.filter(item => item.userId === req.user.id && (!status || item.bookingStatus === status));
  res.json(items);
});

router.get('/:bookingId', (req, res, next) => {
  try {
    const db = readDb();
    const booking = db.bookings.find(item => item.id === req.params.bookingId);
    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }
    res.json(booking);
  } catch (error) {
    next(error);
  }
});

router.post('/:bookingId/reviews', (req, res, next) => {
  try {
    const payload = req.body || {};
    const db = readDb();
    const booking = db.bookings.find(item => item.id === req.params.bookingId);

    if (!booking) {
      throw new HttpError(404, 'Booking not found');
    }
    if (booking.userId !== req.user.id) {
      throw new HttpError(403, 'You can only review your own visits');
    }
    if (booking.bookingStatus !== BOOKING_STATUS.COMPLETED) {
      throw new HttpError(400, 'Only completed bookings can be reviewed');
    }
    if (booking.reviewSubmitted) {
      throw new HttpError(400, 'Review already submitted for this visit');
    }

    const rating = Number(payload.rating || 0);
    const cleanliness = Number(payload.cleanliness || 0);
    const safety = Number(payload.safety || 0);
    const facilities = Number(payload.facilities || 0);
    const valueForMoney = Number(payload.valueForMoney || 0);

    const review = {
      id: nextId('review'),
      bookingId: booking.id,
      toiletId: booking.toiletId,
      userName: req.user.name || 'PNP user',
      rating,
      cleanliness,
      safety,
      facilities,
      valueForMoney,
      comment: String(payload.comment || '').trim(),
      highlights: payload.highlights || [],
      createdAt: new Date().toISOString(),
    };

    let updatedBooking;
    let toilet;

    updateDb(current => {
      current.reviews.unshift(review);
      current.bookings = current.bookings.map(item => {
        if (item.id !== booking.id) return item;
        updatedBooking = { ...item, reviewSubmitted: true, reviewId: review.id };
        return updatedBooking;
      });
      current.toilets = current.toilets.map(item => {
        if (item.id !== booking.toiletId) return item;
        const nextReviewCount = Number(item.reviewCount || 0) + 1;
        const currentWeightedTotal = Number(item.rating || 0) * Number(item.reviewCount || 0);
        return {
          ...item,
          rating: Number(((currentWeightedTotal + rating) / nextReviewCount).toFixed(1)),
          reviewCount: nextReviewCount,
        };
      });
      toilet = current.toilets.find(item => item.id === booking.toiletId);
      return current;
    });

    res.status(201).json({
      review,
      booking: updatedBooking,
      toilet: mapToilet(toilet, req.user, readDb().reviews),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
