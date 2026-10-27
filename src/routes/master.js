const express = require('express');
const { readDb } = require('../store/db');
const { publicMaster } = require('../services/master');
const { publicSettings } = require('../services/settings');

const router = express.Router();

router.get('/', (req, res) => {
  const db = readDb();
  res.json({ ...publicMaster(db), settings: publicSettings(db) });
});

module.exports = router;
