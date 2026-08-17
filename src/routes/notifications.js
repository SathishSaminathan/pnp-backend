const express = require('express');
const { readDb } = require('../store/db');

const router = express.Router();

router.get('/', (req, res) => {
  const { audience } = req.query;
  const db = readDb();
  const items = db.notifications.filter(item => {
    if (item.userId && item.userId !== req.user.id) return false;
    if (audience && item.audience !== audience) return false;
    return true;
  });
  res.json(items);
});

module.exports = router;
