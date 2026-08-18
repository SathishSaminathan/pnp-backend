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
    const key = item.toiletId || item.toiletName || item.id;
    if (!byToiletMap[key]) {
      const toilet = toilets.find(entry => entry.id === item.toiletId);
      byToiletMap[key] = {
        toiletId: item.toiletId || null,
        name: toilet?.name || item.toiletName || 'Toilet',
        area: toilet?.address?.area || '',
        city: toilet?.address?.city || '',
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
