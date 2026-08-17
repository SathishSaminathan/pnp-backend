const { publicUser } = require('../utils');

const ownerIds = db => new Set(db.toilets.map(item => item.ownerId));

const enrichUser = (user, db) => {
  const toilets = db.toilets.filter(item => item.ownerId === user.id);
  const bookings = db.bookings.filter(item => item.userId === user.id);
  const ownerTxns = db.transactions.filter(item => item.ownerId === user.id);
  return {
    ...publicUser(user),
    role: toilets.length ? 'owner' : 'customer',
    listingCount: toilets.length,
    bookingCount: bookings.length,
    favoriteCount: (user.favoriteToiletIds || []).length,
    earningsNet: ownerTxns.reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
  };
};

const enrichOwner = (user, db) => {
  const toilets = db.toilets.filter(item => item.ownerId === user.id);
  const bookings = db.bookings.filter(item => toilets.some(toilet => toilet.id === item.toiletId));
  const txns = db.transactions.filter(item => item.ownerId === user.id);
  return {
    ...enrichUser(user, db),
    listings: toilets.map(item => ({ id: item.id, name: item.name, verified: item.verified, availability: item.availability })),
    hostBookingCount: bookings.length,
    settledAmount: txns.filter(item => item.settlementStatus === 'SETTLED').reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
    pendingAmount: txns.filter(item => item.settlementStatus !== 'SETTLED').reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
  };
};

const overview = db => {
  const owners = ownerIds(db);
  const gross = db.transactions.reduce((sum, item) => sum + Number(item.grossAmount || 0), 0);
  const fees = db.transactions.reduce((sum, item) => sum + Number(item.platformFee || 0), 0);
  const net = db.transactions.reduce((sum, item) => sum + Number(item.netAmount || 0), 0);
  const pending = db.transactions
    .filter(item => item.settlementStatus !== 'SETTLED')
    .reduce((sum, item) => sum + Number(item.netAmount || 0), 0);
  const settled = net - pending;

  return {
    users: db.users.length,
    owners: [...owners].length,
    customers: db.users.filter(user => !owners.has(user.id)).length,
    listings: db.toilets.length,
    bookings: db.bookings.length,
    reviews: db.reviews.length,
    earnings: {
      today: 420,
      week: 2680,
      month: 10840,
      total: 84220 + net,
      gross,
      fees,
      net,
      pending,
      settled,
    },
    recentBookings: db.bookings.slice(0, 8),
    recentTransactions: db.transactions.slice(0, 8),
  };
};

module.exports = { ownerIds, enrichUser, enrichOwner, overview };
