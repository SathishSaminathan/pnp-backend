const express = require('express');
const { HttpError, publicUser } = require('../utils');
const { updateDb } = require('../store/db');

const router = express.Router();

const profileUser = user => ({
  id: user.id,
  phone: user.phone,
  name: user.name || '',
  city: user.city || '',
  profileCompleted: Boolean(user.profileCompleted),
});

router.get('/', (req, res) => {
  res.json(publicUser(req.user));
});

router.put('/', (req, res, next) => {
  try {
    const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
    const city = req.body?.city != null ? String(req.body.city).trim() : undefined;
    if (name !== undefined && !name) {
      throw new HttpError(400, 'Name is required');
    }
    if (city !== undefined && !city) {
      throw new HttpError(400, 'City is required');
    }

    let saved = req.user;
    updateDb(db => {
      db.users = db.users.map(item => {
        if (item.id !== req.user.id) return item;
        saved = {
          ...item,
          name: name !== undefined ? name : item.name,
          city: city !== undefined ? city : item.city,
          profileCompleted: true,
        };
        return saved;
      });
      return db;
    });

    res.json({
      message: 'Profile updated successfully',
      user: profileUser(saved),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
