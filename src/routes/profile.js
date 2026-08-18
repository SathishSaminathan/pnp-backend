const express = require('express');
const { HttpError, publicUser } = require('../utils');
const { setUserDeviceToken } = require('../services/users');
const { updateDb } = require('../store/db');
const { parseProfilePhoto } = require('../middleware/upload');
const { deletePhotoUrls, normalizeProfilePhotoUrl, uploadProfilePhoto } = require('../services/uploads');

const router = express.Router();

const saveUserPhoto = async (user, photoUrl) => {
  const previous = user.photoUrl;
  let saved = user;
  updateDb(db => {
    db.users = db.users.map(item => {
      if (item.id !== user.id) return item;
      saved = { ...item, photoUrl: photoUrl || '' };
      return saved;
    });
    return db;
  });
  if (previous && previous !== saved.photoUrl) {
    await deletePhotoUrls([previous]);
  }
  return saved;
};

router.get('/', (req, res) => {
  res.json(publicUser(req.user));
});

router.put('/device-token', (req, res, next) => {
  try {
    let saved = req.user;
    updateDb(db => {
      saved = setUserDeviceToken(db, req.user.id, req.body?.deviceToken);
      return db;
    });
    res.json({
      message: 'Device token updated',
      user: publicUser(saved),
    });
  } catch (error) {
    next(error);
  }
});

router.post('/photo', parseProfilePhoto, async (req, res, next) => {
  try {
    const file = (req.files || [])[0] || req.file;
    const photoUrl = await uploadProfilePhoto({ userId: req.user.id, file });
    const saved = await saveUserPhoto(req.user, photoUrl);
    res.status(201).json({
      message: 'Profile photo updated',
      photoUrl: publicUser(saved).photoUrl,
      user: publicUser(saved),
    });
  } catch (error) {
    next(error);
  }
});

router.put('/', async (req, res, next) => {
  try {
    const name = req.body?.name != null ? String(req.body.name).trim() : undefined;
    const city = req.body?.city != null ? String(req.body.city).trim() : undefined;
    const deviceToken = req.body?.deviceToken;
    const photoUrl = Object.prototype.hasOwnProperty.call(req.body || {}, 'photoUrl')
      ? normalizeProfilePhotoUrl(req.body.photoUrl)
      : undefined;
    if (name !== undefined && !name) {
      throw new HttpError(400, 'Name is required');
    }
    if (city !== undefined && !city) {
      throw new HttpError(400, 'City is required');
    }

    let saved = req.user;
    const previousPhoto = req.user.photoUrl;
    updateDb(db => {
      db.users = db.users.map(item => {
        if (item.id !== req.user.id) return item;
        saved = {
          ...item,
          name: name !== undefined ? name : item.name,
          city: city !== undefined ? city : item.city,
          photoUrl: photoUrl !== undefined ? photoUrl : item.photoUrl || '',
          profileCompleted: true,
        };
        return saved;
      });
      if (deviceToken !== undefined) {
        saved = setUserDeviceToken(db, req.user.id, deviceToken);
      }
      return db;
    });

    if (photoUrl !== undefined && previousPhoto && previousPhoto !== saved.photoUrl) {
      await deletePhotoUrls([previousPhoto]);
    }

    res.json({
      message: 'Profile updated successfully',
      user: publicUser(saved),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
