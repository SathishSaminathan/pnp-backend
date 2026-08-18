require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  databaseUrl: process.env.DATABASE_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'pnp-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '30d',
  devOtp: String(process.env.DEV_OTP || '123456'),
  platformFee: 5,
  adminEmail: String(process.env.ADMIN_EMAIL || 'admin@pnp.app').toLowerCase().trim(),
  adminPassword: String(process.env.ADMIN_PASSWORD || 'Admin@123'),
  fcmBroadcastTopic: String(process.env.FCM_BROADCAST_TOPIC || 'pnp_broadcast').trim(),
  firebaseServiceAccountPath: String(
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.GOOGLE_APPLICATION_CREDENTIALS || '',
  ).trim(),
  firebaseServiceAccountJson: String(process.env.FIREBASE_SERVICE_ACCOUNT_JSON || '').trim(),
  firebaseServiceAccountBase64: String(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 || '').trim(),
};
