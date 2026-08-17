const express = require('express');
const { readDb } = require('../store/db');
const { publicMaster } = require('../services/master');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(publicMaster(readDb()));
});

module.exports = router;
