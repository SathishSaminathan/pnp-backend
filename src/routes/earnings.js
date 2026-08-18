const express = require('express');
const { readDb } = require('../store/db');
const { publicTransaction } = require('../services/payments');
const { summarizeTransactions } = require('../services/earnings');

const router = express.Router();

router.get('/', (req, res) => {
  const db = readDb();
  const toilets = db.toilets.filter(item => item.ownerId === req.user.id);
  const transactions = db.transactions.filter(item => item.ownerId === req.user.id);
  res.json(
    summarizeTransactions(transactions, {
      toilets,
      bookings: db.bookings,
    }),
  );
});

router.get('/transactions', (req, res) => {
  const db = readDb();
  const items = db.transactions
    .filter(item => item.ownerId === req.user.id)
    .map(publicTransaction);
  res.json({ items, total: items.length });
});

module.exports = router;
