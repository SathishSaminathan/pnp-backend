const fs = require('fs');
const path = require('path');
const { cert, getApps, initializeApp } = require('firebase-admin/app');
const { getMessaging: getFirebaseMessaging } = require('firebase-admin/messaging');
const config = require('../config');
const { readDb, updateDb } = require('../store/db');
const { setUserDeviceToken } = require('./users');

const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

let messagingClient = null;
let initError = null;

const resolveServiceAccountPath = () => {
  const fromEnv = config.firebaseServiceAccountPath;
  if (fromEnv) {
    return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
  }
  return path.resolve(__dirname, '../../secrets/firebase-adminsdk.json');
};

const unwrapEnvText = raw => {
  let text = String(raw || '').trim();
  if (!text) return '';
  if (
    (text.startsWith("'") && text.endsWith("'")) ||
    (text.startsWith('"') && text.endsWith('"') && !text.startsWith('{'))
  ) {
    text = text.slice(1, -1).trim();
  }
  return text;
};

const parseJsonMaybe = raw => {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  const text = unwrapEnvText(raw);
  if (!text) return null;
  try {
    const parsed = JSON.parse(text);
    return typeof parsed === 'string' ? JSON.parse(parsed) : parsed;
  } catch (error) {
    throw new Error(`Firebase service account JSON is invalid: ${error.message}`);
  }
};

const normalizeServiceAccount = raw => {
  const parsed = parseJsonMaybe(raw);
  if (!parsed || typeof parsed !== 'object') return null;
  const privateKey = String(parsed.private_key || parsed.privateKey || '').replace(/\\n/g, '\n');
  const clientEmail = String(parsed.client_email || parsed.clientEmail || '').trim();
  const projectId = String(parsed.project_id || parsed.projectId || '').trim();
  if (!privateKey || !clientEmail) {
    throw new Error('Firebase service account is missing private_key or client_email');
  }
  return {
    ...parsed,
    type: parsed.type || 'service_account',
    project_id: projectId,
    client_email: clientEmail,
    private_key: privateKey,
  };
};

const loadFromPath = filePath => {
  if (!filePath || !fs.existsSync(filePath)) return null;
  return normalizeServiceAccount(fs.readFileSync(filePath, 'utf8'));
};

const loadServiceAccount = () => {
  const jsonEnv = unwrapEnvText(config.firebaseServiceAccountJson);
  if (jsonEnv) {
    if (jsonEnv.startsWith('{')) {
      return normalizeServiceAccount(jsonEnv);
    }
    const asPath = path.isAbsolute(jsonEnv) ? jsonEnv : path.resolve(process.cwd(), jsonEnv);
    const fromJsonPath = loadFromPath(asPath);
    if (fromJsonPath) return fromJsonPath;
  }

  const base64 = unwrapEnvText(config.firebaseServiceAccountBase64);
  if (base64) {
    return normalizeServiceAccount(Buffer.from(base64, 'base64').toString('utf8'));
  }

  return loadFromPath(resolveServiceAccountPath());
};

const getMessaging = () => {
  if (messagingClient) return messagingClient;
  if (initError) return null;

  try {
    const existing = getApps();
    if (existing.length) {
      messagingClient = getFirebaseMessaging(existing[0]);
      return messagingClient;
    }

    const serviceAccount = loadServiceAccount();
    if (!serviceAccount) {
      initError = 'missing_firebase_admin';
      console.warn(
        'Push: Firebase Admin is not configured. On Railway set FIREBASE_SERVICE_ACCOUNT_JSON to the minified service-account JSON (not a file path).',
      );
      return null;
    }

    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.project_id,
    });
    messagingClient = getFirebaseMessaging(app);
    console.log(`Push: Firebase Admin ready (${serviceAccount.project_id})`);
    return messagingClient;
  } catch (error) {
    initError = error.message || 'firebase_init_failed';
    console.warn('Push: Firebase Admin failed to initialize', initError);
    return null;
  }
};

const getFirebaseStatus = () => ({
  configured: Boolean(getMessaging()),
  reason: initError || null,
  topic: config.fcmBroadcastTopic,
});

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
    return { skipped: true, reason: initError || 'missing_firebase_admin' };
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
    return { skipped: true, reason: initError || 'missing_firebase_admin' };
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
  const user = (readDb().users || []).find(item => item.id === userId);
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
  getFirebaseStatus,
};
