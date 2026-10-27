const config = require('../config');
const { DISCOVERY_FILTER_DEFAULTS } = require('../constants');
const { HttpError } = require('../utils');

/** Defaults match the values that used to be hard-coded, so behaviour is unchanged until an admin edits them. */
const defaultSettings = () => ({
  platformFee: config.platformFee,
  taxAmount: 2,
  discovery: {
    maxPrice: DISCOVERY_FILTER_DEFAULTS.maxPrice,
    maxDistanceKm: DISCOVERY_FILTER_DEFAULTS.maxDistanceKm,
    quickFilterMaxPrice: 30,
  },
  support: { email: 'support@pnp.app' },
});

const toNumber = (value, fallback) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const mergeSettings = raw => {
  const d = defaultSettings();
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    platformFee: toNumber(s.platformFee, d.platformFee),
    taxAmount: toNumber(s.taxAmount, d.taxAmount),
    discovery: {
      maxPrice: toNumber(s.discovery?.maxPrice, d.discovery.maxPrice),
      maxDistanceKm: toNumber(s.discovery?.maxDistanceKm, d.discovery.maxDistanceKm),
      quickFilterMaxPrice: toNumber(s.discovery?.quickFilterMaxPrice, d.discovery.quickFilterMaxPrice),
    },
    support: { email: String(s.support?.email || d.support.email).trim() },
  };
};

const getSettings = db => mergeSettings(db?.settings);

const assertNonNegative = (value, label) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${label} must be a number, 0 or more`);
  return n;
};
const assertPositive = (value, label) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) throw new HttpError(400, `${label} must be greater than 0`);
  return n;
};

/** Validates an admin edit and returns the full settings object to store. */
const applySettingsUpdate = (current, payload = {}) => {
  const next = mergeSettings(current);
  if (payload.platformFee !== undefined) next.platformFee = assertNonNegative(payload.platformFee, 'Platform fee');
  if (payload.taxAmount !== undefined) next.taxAmount = assertNonNegative(payload.taxAmount, 'Tax');
  const d = payload.discovery || {};
  if (d.maxPrice !== undefined) next.discovery.maxPrice = assertPositive(d.maxPrice, 'Max price filter');
  if (d.maxDistanceKm !== undefined) next.discovery.maxDistanceKm = assertPositive(d.maxDistanceKm, 'Max distance filter');
  if (d.quickFilterMaxPrice !== undefined) {
    next.discovery.quickFilterMaxPrice = assertPositive(d.quickFilterMaxPrice, 'Quick filter price');
  }
  if (payload.support?.email !== undefined) {
    const email = String(payload.support.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'Support email is not valid');
    next.support.email = email;
  }
  return next;
};

/** What the mobile app may see. */
const publicSettings = db => {
  const s = getSettings(db);
  return { supportEmail: s.support.email, platformFee: s.platformFee, taxAmount: s.taxAmount };
};

module.exports = { defaultSettings, mergeSettings, getSettings, applySettingsUpdate, publicSettings };
