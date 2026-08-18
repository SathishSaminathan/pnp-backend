const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');
const config = require('../config');
const { readDb, updateDb } = require('../store/db');
const { setUserDeviceToken } = require('./users');

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

let app = null;

const resolveServiceAccountPath = () => {
  const fromEnv = config.firebaseServiceAccountPath;
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }
  return path.resolve(__dirname, '../../secrets/firebase-adminsdk.json');
};

const loadServiceAccount = () => {
  if (config.firebaseServiceAccountJson) {
    return JSON.parse(config.firebaseServiceAccountJson);
  }
  const filePath = resolveServiceAccountPath();
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const getMessaging = () => {
  if (app) {
    return admin.messaging(app);
  }
  if (admin.apps.length) {
    app = admin.app();
    return admin.messaging(app);
  }
  const serviceAccount = loadServiceAccount();
  if (!serviceAccount) {
    return null;
  }
  app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: serviceAccount.project_id,
  });
  return admin.messaging(app);
};

const stringifyData = data => {
  const payload = data && typeof data === 'object' ? data : {};
  return Object.fromEntries(
    Object.entries(payload).map(([key, value]) => [
      key,
      value == null || typeof value === 'string' ? String(value || '') : JSON.stringify(value),
    ]),
  );
};

const buildMessage = ({ title, body, data } = {}) => {
  const dataPayload = stringifyData({
    title: title || '',
    body: body || '',
    actionType: data?.actionType || 'BROADCAST',
    ...data,
  });
  return {
    notification: {
      title: title || '',
      body: body || '',
    },
    data: dataPayload,
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'custom_sound_channel',
      },
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          alert: {
            title: title || '',
            body: body || '',
          },
        },
      },
    },
  };
};

const sendToToken = async (token, payload = {}) => {
  const deviceToken = String(token || '').trim();
  if (!deviceToken) {
    return { skipped: true, reason: 'missing_token' };
  }

  const messaging = getMessaging();
  if (!messaging) {
    console.warn(
      'Push: Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    return { skipped: true, reason: 'missing_firebase_admin' };
  }

  try {
    const messageId = await messaging.send({
      token: deviceToken,
      ...buildMessage(payload),
    });
    return { ok: true, messageId };
  } catch (error) {
    const code = error?.code || '';
    console.warn('Push: FCM send failed', code, error?.message);
    if (INVALID_TOKEN_CODES.has(code) || /registration-token/i.test(String(error?.message || ''))) {
      return { ok: false, invalidToken: true, error: code || error.message };
    }
    return { ok: false, error: code || error.message };
  }
};

const sendToTopic = async (topic, payload = {}) => {
  const name = String(topic || config.fcmBroadcastTopic || '').trim();
  if (!name) {
    return { skipped: true, reason: 'missing_topic' };
  }

  const messaging = getMessaging();
  if (!messaging) {
    console.warn(
      'Push: Firebase Admin is not configured. Set FIREBASE_SERVICE_ACCOUNT_PATH or FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    return { skipped: true, reason: 'missing_firebase_admin' };
  }

  try {
    const messageId = await messaging.send({
      topic: name,
      ...buildMessage(payload),
    });
    return { ok: true, messageId, topic: name };
  } catch (error) {
    console.warn('Push: FCM topic send failed', error?.code, error?.message);
    return { ok: false, error: error?.code || error.message };
  }
};

const sendPushToUser = async (user, payload) => {
  const result = await sendToToken(user?.deviceToken, payload);
  if (result.invalidToken && user?.id) {
    updateDb(db => {
      setUserDeviceToken(db, user.id, '');
      return db;
    });
  }
  return result;
};

const sendPushToUserId = async (userId, payload) => {
  const user = readDb().users.find(item => item.id === userId);
  if (!user) {
    return { skipped: true, reason: 'user_not_found' };
  }
  return sendPushToUser(user, payload);
};

const sendBroadcast = payload => sendToTopic(config.fcmBroadcastTopic, payload);

module.exports = {
  sendToToken,
  sendToTopic,
  sendBroadcast,
  sendPushToUser,
  sendPushToUserId,
};
