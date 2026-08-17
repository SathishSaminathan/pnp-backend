const express = require('express');
const { updateDb } = require('../store/db');
const { publicUser } = require('../utils');

const router = express.Router();

router.get('/', (req, res) => {
  res.json(publicUser(req.user));
});

router.put('/', (req, res) => {
  const { name, city } = req.body || {};
  let saved = req.user;

  updateDb(db => {
    db.users = db.users.map(item => {
      if (item.id !== req.user.id) return item;
      saved = {
        ...item,
        name: name != null ? String(name).trim() : item.name,
        city: city != null ? String(city).trim() : item.city,
        profileCompleted: true,
      };
      return saved;
    });
    return db;
  });

  res.json(publicUser(saved));
});

module.exports = router;
