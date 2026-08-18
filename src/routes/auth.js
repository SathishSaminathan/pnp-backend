const express = require('express');
const { sendOtp, consumeOtp } = require('../services/otp');
const { setUserDeviceToken } = require('../services/users');
const { readDb, updateDb, nextId } = require('../store/db');
const { publicUser, normalizePhone, assertNotBlocked } = require('../utils');
const { signAccessToken, signRefreshToken } = require('../middleware/auth');

const router = express.Router();

router.post('/otp', (req, res, next) => {
  try {
    const phone = req.body?.phone ?? req.body;
    const normalized = normalizePhone(phone);
    const existing = readDb().users.find(item => item.phone === normalized);
    assertNotBlocked(existing);
    res.json(sendOtp(phone));
  } catch (error) {
    next(error);
  }
});

router.post('/otp/verify', (req, res, next) => {
  try {
    const { phone, otp, requestId, deviceToken } = req.body || {};
    const normalizedPhone = consumeOtp({ phone, otp, requestId });
    const db = readDb();
    let user = db.users.find(item => item.phone === normalizedPhone);
    const isNewUser = !user;

    if (user) {
      assertNotBlocked(user);
    }

    if (!user) {
      user = {
        id: nextId('user'),
        phone: normalizedPhone,
        name: '',
        city: '',
        profileCompleted: false,
        favoriteToiletIds: [],
        blocked: false,
        deviceToken: '',
      };
    }

    if (isNewUser || String(deviceToken || '').trim()) {
      updateDb(current => {
        if (isNewUser) {
          current.users.push(user);
        }
        if (String(deviceToken || '').trim()) {
          user = setUserDeviceToken(current, user.id, deviceToken);
        }
        return current;
      });
    }

    res.json({
      accessToken: signAccessToken(user),
      refreshToken: signRefreshToken(user),
      isNewUser,
      profileCompleted: Boolean(user.profileCompleted),
      user: publicUser(user),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
