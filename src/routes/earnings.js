const express = require('express');
const { readDb } = require('../store/db');
const { publicTransaction } = require('../services/payments');

const router = express.Router();

const SEED_EARNINGS = {
  user_001: { today: 420, week: 2680, month: 10840, total: 84220 },
};

router.get('/', (req, res) => {
  const db = readDb();
  const owned = db.transactions.filter(item => item.ownerId === req.user.id);
  const extra = owned
    .filter(item => !['txn_001', 'txn_002'].includes(item.id))
    .reduce((total, item) => total + Number(item.netAmount || 0), 0);
  const base = SEED_EARNINGS[req.user.id] || { today: 0, week: 0, month: 0, total: 0 };

  res.json({
    today: base.today + extra,
    week: base.week + extra,
    month: base.month + extra,
    total: base.total + extra,
  });
});

router.get('/transactions', (req, res) => {
  const db = readDb();
  res.json(db.transactions.filter(item => item.ownerId === req.user.id).map(publicTransaction));
});

module.exports = router;
