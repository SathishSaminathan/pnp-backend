require('dotenv').config();

module.exports = {
  port: Number(process.env.PORT || 4000),
  jwtSecret: process.env.JWT_SECRET || 'pnp-dev-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  refreshExpiresIn: process.env.REFRESH_EXPIRES_IN || '30d',
  devOtp: String(process.env.DEV_OTP || '123456'),
  platformFee: 5,
};
