const config = require('../config');
const { HttpError, normalizePhone } = require('../utils');

const challenges = new Map();

const sendOtp = phoneInput => {
  const phone = normalizePhone(phoneInput);
  if (phone.length !== 10) {
    throw new HttpError(400, 'Enter a valid 10-digit mobile number.');
  }

  const requestId = `otp_${Date.now()}`;
  const otp = config.devOtp;
  const expiresIn = 120;
  const resendIn = 30;

  challenges.set(phone, {
    requestId,
    otp,
    expiresAt: Date.now() + expiresIn * 1000,
    attempts: 0,
  });

  return {
    requestId,
    phone,
    expiresIn,
    resendIn,
    mockOtp: otp,
    isExistingUser: !phone.endsWith('0000'),
  };
};

const consumeOtp = ({ phone: phoneInput, otp, requestId }) => {
  const phone = normalizePhone(phoneInput);
  const challenge = challenges.get(phone);

  if (!challenge) {
    throw new HttpError(400, 'OTP not found. Please request a new code.');
  }
  if (requestId && challenge.requestId !== requestId) {
    throw new HttpError(400, 'OTP session expired. Please request a new code.');
  }
  if (Date.now() > challenge.expiresAt) {
    challenges.delete(phone);
    throw new HttpError(400, 'OTP expired. Please resend.');
  }
  if (challenge.attempts >= 5) {
    challenges.delete(phone);
    throw new HttpError(400, 'Maximum attempts reached. Please resend OTP.');
  }
  if (String(otp || '') !== String(challenge.otp)) {
    challenge.attempts += 1;
    throw new HttpError(400, `Invalid OTP. Attempts left: ${Math.max(0, 5 - challenge.attempts)}`);
  }

  challenges.delete(phone);
  return phone;
};

module.exports = { sendOtp, consumeOtp };
