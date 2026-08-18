class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = extra.code;
  }
}

const normalizePhone = value => String(value || '').replace(/\D/g, '').slice(-10);

const publicUser = user => ({
  id: user.id,
  phone: user.phone,
  name: user.name,
  city: user.city,
  profileCompleted: Boolean(user.profileCompleted),
  favoriteToiletIds: user.favoriteToiletIds || [],
  blocked: Boolean(user.blocked),
  blockedAt: user.blockedAt || null,
  blockedReason: user.blockedReason || '',
  hasDeviceToken: Boolean(user.deviceToken),
});

const isBlocked = user => Boolean(user?.blocked);

const assertNotBlocked = user => {
  if (isBlocked(user)) {
    throw new HttpError(403, 'This account has been blocked. Contact support.', { code: 'ACCOUNT_BLOCKED' });
  }
};

const parseTimeToken = token => {
  const [hourPart, minutePartAndPeriod] = String(token || '').trim().split(':');
  const [minutePart, rawPeriod] = String(minutePartAndPeriod || '').trim().split(' ');
  const period = String(rawPeriod || '').toUpperCase();
  if (!hourPart || !minutePart || !period) return null;

  let hours = Number(hourPart);
  const minutes = Number(minutePart);
  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const isOpenNow = operatingHours => {
  if (!operatingHours) return false;
  if (String(operatingHours).trim().toLowerCase() === '24 hours') return true;

  const [startToken, endToken] = String(operatingHours).split('-').map(part => part.trim());
  const start = parseTimeToken(startToken);
  const end = parseTimeToken(endToken);
  if (start == null || end == null) return false;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (start <= end) return nowMinutes >= start && nowMinutes <= end;
  return nowMinutes >= start || nowMinutes <= end;
};

const toRad = degrees => (Number(degrees) * Math.PI) / 180;

const parseCoord = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const parseOrigin = value => {
  if (!value || typeof value !== 'object') return null;
  const latitude = parseCoord(value.latitude ?? value.lat);
  const longitude = parseCoord(value.longitude ?? value.lng);
  if (latitude == null || longitude == null) return null;
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude };
};

const parseBounds = (bounds, fallback = {}) => {
  const source = bounds && typeof bounds === 'object' ? bounds : fallback;
  const minLat = parseCoord(source.minLat ?? source.min_lat);
  const maxLat = parseCoord(source.maxLat ?? source.max_lat);
  const minLng = parseCoord(source.minLng ?? source.min_lng);
  const maxLng = parseCoord(source.maxLng ?? source.max_lng);
  if ([minLat, maxLat, minLng, maxLng].some(item => item == null)) return null;
  return {
    minLat: clamp(Math.min(minLat, maxLat), -90, 90),
    maxLat: clamp(Math.max(minLat, maxLat), -90, 90),
    minLng: clamp(Math.min(minLng, maxLng), -180, 180),
    maxLng: clamp(Math.max(minLng, maxLng), -180, 180),
  };
};

const haversineKm = (from, to) => {
  const origin = parseOrigin(from);
  const point = parseOrigin(to);
  if (!origin || !point) return null;
  const earthKm = 6371;
  const dLat = toRad(point.latitude - origin.latitude);
  const dLng = toRad(point.longitude - origin.longitude);
  const lat1 = toRad(origin.latitude);
  const lat2 = toRad(point.latitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return earthKm * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const isInBounds = (coordinates, bounds) => {
  const point = parseOrigin(coordinates);
  const box = parseBounds(bounds);
  if (!point || !box) return false;
  return (
    point.latitude >= box.minLat &&
    point.latitude <= box.maxLat &&
    point.longitude >= box.minLng &&
    point.longitude <= box.maxLng
  );
};

const roundKm = km => Math.round(Number(km) * 10) / 10;

module.exports = {
  HttpError,
  normalizePhone,
  publicUser,
  isBlocked,
  assertNotBlocked,
  isOpenNow,
  parseOrigin,
  parseBounds,
  haversineKm,
  isInBounds,
  roundKm,
};
