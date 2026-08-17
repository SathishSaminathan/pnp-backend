class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
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
});

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

module.exports = {
  HttpError,
  normalizePhone,
  publicUser,
  isOpenNow,
};
