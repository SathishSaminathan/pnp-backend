const express = require('express');
const config = require('../config');
const { BOOKING_STATUS, PAYMENT_STATUS, SETTLEMENT_STATUS } = require('../constants');
const { HttpError } = require('../utils');
const { readDb, updateDb, nextId } = require('../store/db');
const { saveQuote, getQuote, saveOrder, getOrder } = require('../services/payments');
const { sendPushToUserId } = require('../services/push');

const router = express.Router();

router.post('/quote', (req, res, next) => {
  try {
    const { toiletId, date, time } = req.body || {};
    const db = readDb();
    const toilet = db.toilets.find(item => item.id === toiletId);
    if (!toilet) {
      throw new HttpError(404, 'Toilet not found');
    }
    if (toilet.ownerId === req.user.id) {
      throw new HttpError(400, 'You cannot book your own listing.');
    }
    if (toilet.enabled === false) {
      throw new HttpError(400, 'This restroom is currently disabled.');
    }
    if (toilet.availability === 'MAINTENANCE') {
      throw new HttpError(400, 'This restroom is under maintenance.');
    }

    const amount = Number(toilet.basePrice);
    const quote = saveQuote({
      quoteId: nextId('quote'),
      toiletId,
      toiletName: toilet.name,
      date,
      time,
      duration: 'Per use',
      amount,
      platformFee: config.platformFee,
      totalAmount: amount + config.platformFee,
    });
    res.json(quote);
  } catch (error) {
    next(error);
  }
});

router.post('/orders', (req, res, next) => {
  try {
    const quote = req.body || {};
    if (!quote.toiletId || quote.totalAmount == null) {
      throw new HttpError(400, 'A valid quote is required to start payment.');
    }

    const order = saveOrder({
      orderId: nextId('order'),
      razorpayKey: 'rzp_test_mock_key',
      amount: quote.totalAmount,
      currency: 'INR',
      quote,
      method: quote.method || 'upi',
      userId: req.user.id,
    });
    res.json(order);
  } catch (error) {
    next(error);
  }
});

router.post('/verify', (req, res, next) => {
  try {
    const payment = req.body || {};
    const quote = payment.quote || getOrder(payment.orderId)?.quote || getQuote(payment.quoteId);
    if (!quote?.toiletId) {
      throw new HttpError(400, 'Payment quote not found.');
    }

    const db = readDb();
    const toilet = db.toilets.find(item => item.id === quote.toiletId);
    if (!toilet) {
      throw new HttpError(404, 'Toilet not found');
    }
    if (toilet.ownerId === req.user.id) {
      throw new HttpError(400, 'You cannot book your own listing.');
    }
    if (toilet.enabled === false) {
      throw new HttpError(400, 'This restroom is currently disabled.');
    }

    const booking = {
      id: nextId('booking'),
      toiletId: quote.toiletId,
      userId: req.user.id,
      toiletName: quote.toiletName,
      date: quote.date,
      time: quote.time,
      duration: quote.duration || 'Per use',
      amount: quote.totalAmount,
      paymentStatus: PAYMENT_STATUS.PAID,
      bookingStatus: BOOKING_STATUS.COMPLETED,
      reviewSubmitted: false,
    };

    const taxAmount = 2;
    const platformFee = Number(quote.platformFee || config.platformFee);
    const transaction = {
      id: nextId('txn'),
      ownerId: toilet.ownerId,
      bookingId: booking.id,
      toiletName: quote.toiletName,
      grossAmount: quote.totalAmount,
      platformFee,
      taxAmount,
      netAmount: Number(quote.totalAmount) - platformFee - taxAmount,
      paymentStatus: PAYMENT_STATUS.PAID,
      settlementStatus: SETTLEMENT_STATUS.SETTLED,
    };

    updateDb(current => {
      current.bookings.unshift(booking);
      current.transactions.unshift(transaction);
      current.notifications.unshift({
        id: nextId('notification'),
        userId: req.user.id,
        title: 'Payment confirmed',
        body: `Payment confirmed for ${booking.toiletName}.`,
        audience: 'customer',
        createdAt: new Date().toISOString(),
      });
      current.notifications.unshift({
        id: nextId('notification'),
        userId: toilet.ownerId,
        title: 'New booking received',
        body: `A customer booked ${booking.toiletName} for ${booking.date}, ${booking.time}.`,
        audience: 'provider',
        createdAt: new Date().toISOString(),
      });
      return current;
    });

    const customerPush = {
      title: 'Payment confirmed',
      body: `Payment confirmed for ${booking.toiletName}.`,
      data: { actionType: 'BROADCAST', bookingId: booking.id, audience: 'customer' },
    };
    const ownerPush = {
      title: 'New booking received',
      body: `A customer booked ${booking.toiletName} for ${booking.date}, ${booking.time}.`,
      data: { actionType: 'BROADCAST', bookingId: booking.id, audience: 'provider' },
    };
    Promise.allSettled([
      sendPushToUserId(req.user.id, customerPush),
      sendPushToUserId(toilet.ownerId, ownerPush),
    ]).catch(error => {
      console.warn('Push: failed to send booking notifications', error?.message || error);
    });

    res.json(booking);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
