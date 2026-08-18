const { publicTransaction } = require('./payments');

const toMoney = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const startOfLocalDay = date => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const transactionTime = (item, bookings = []) => {
  if (item.createdAt) {
    const ts = new Date(item.createdAt).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  const booking = bookings.find(entry => entry.id === item.bookingId);
  if (booking?.date) {
    const ts = new Date(`${booking.date}T00:00:00`).getTime();
    if (!Number.isNaN(ts)) return ts;
  }
  return 0;
};

const sumField = (items, key) => items.reduce((total, item) => total + toMoney(item[key]), 0);

const toiletAddress = toilet => {
  const address = toilet?.address || {};
  return {
    line1: String(address.line1 || '').trim(),
    area: String(address.area || '').trim(),
    city: String(address.city || toilet?.city || '').trim(),
  };
};

const formatLocation = (...parts) =>
  parts
    .map(part => String(part || '').trim())
    .filter(part => part && part !== '—' && part !== '--');


const namesMatch = (left, right) =>
  String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase() && Boolean(String(left || '').trim());

const matchToilet = (item, toilets = []) =>
  toilets.find(entry => entry.id && entry.id === item.toiletId) ||
  toilets.find(entry => namesMatch(entry.name, item.toiletName)) ||
  null;

const summarizeTransactions = (transactions = [], { toilets = [], bookings = [] } = {}) => {
  const paid = transactions
    .map(publicTransaction)
    .filter(item => item.paymentStatus !== 'FAILED' && item.settlementStatus !== 'FAILED');

  const now = new Date();
  const todayStart = startOfLocalDay(now);
  const weekStart = todayStart - 6 * 24 * 60 * 60 * 1000;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

  const inRange = (item, from) => transactionTime(item, bookings) >= from;
  const todayItems = paid.filter(item => inRange(item, todayStart));
  const weekItems = paid.filter(item => inRange(item, weekStart));
  const monthItems = paid.filter(item => inRange(item, monthStart));

  const byToiletMap = {};
  paid.forEach(item => {
    const toilet = matchToilet(item, toilets);
    const fromToilet = toiletAddress(toilet);
    const key = item.toiletId || toilet?.id || item.toiletName || item.id;
    if (!byToiletMap[key]) {
      const area = fromToilet.area || String(item.area || item.address?.area || '').trim();
      const city = fromToilet.city || String(item.city || item.address?.city || '').trim();
      const line1 = fromToilet.line1 || String(item.line1 || item.address?.line1 || '').trim();
      byToiletMap[key] = {
        toiletId: item.toiletId || toilet?.id || null,
        name: toilet?.name || item.toiletName || 'Toilet',
        area,
        city,
        location: formatLocation(area, city).join(', ') || line1,
        visitCount: 0,
        grossAmount: 0,
        fees: 0,
        netAmount: 0,
      };
    }
    const row = byToiletMap[key];
    row.visitCount += 1;
    row.grossAmount += toMoney(item.grossAmount);
    row.fees += toMoney(item.platformFee) + toMoney(item.taxAmount);
    row.netAmount += toMoney(item.netAmount);
  });

  const byToilet = Object.values(byToiletMap)
    .map(row => ({
      ...row,
      avgTicket: row.visitCount ? Math.round(row.netAmount / row.visitCount) : 0,
    }))
    .sort((left, right) => right.netAmount - left.netAmount);

  const gross = sumField(paid, 'grossAmount');
  const fees = sumField(paid, 'platformFee');
  const tax = sumField(paid, 'taxAmount');
  const net = sumField(paid, 'netAmount');

  return {
    today: sumField(todayItems, 'netAmount'),
    week: sumField(weekItems, 'netAmount'),
    month: sumField(monthItems, 'netAmount'),
    total: net,
    gross,
    fees,
    tax,
    net,
    settled: net,
    visitCount: paid.length,
    listingCount: toilets.length,
    byToilet,
  };
};

module.exports = { toMoney, summarizeTransactions };
