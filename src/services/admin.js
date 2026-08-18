const { publicUser } = require('../utils');
const { publicTransaction } = require('./payments');
const { summarizeTransactions } = require('./earnings');

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
    earningsNet: ownerTxns.map(publicTransaction).reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
  };
};

const enrichOwner = (user, db) => {
  const toilets = db.toilets.filter(item => item.ownerId === user.id);
  const bookings = db.bookings.filter(item => toilets.some(toilet => toilet.id === item.toiletId));
  const txns = db.transactions.filter(item => item.ownerId === user.id).map(publicTransaction);
  return {
    ...enrichUser(user, db),
    listings: toilets.map(item => ({
      id: item.id,
      name: item.name,
      verified: item.verified,
      enabled: item.enabled !== false,
      availability: item.availability,
      basePrice: item.basePrice,
      rating: item.rating,
      reviewCount: item.reviewCount,
      city: item.address?.city,
      area: item.address?.area,
      address: item.address,
    })),
    hostBookingCount: bookings.length,
    settledAmount: txns.filter(item => item.settlementStatus === 'SETTLED').reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
  };
};

const overview = db => {
  const owners = ownerIds(db);
  const txns = db.transactions.map(publicTransaction);

  return {
    users: db.users.length,
    owners: [...owners].length,
    customers: db.users.filter(user => !owners.has(user.id)).length,
    listings: db.toilets.length,
    bookings: db.bookings.length,
    reviews: db.reviews.length,
    earnings: summarizeTransactions(txns, { toilets: db.toilets, bookings: db.bookings }),
    recentBookings: db.bookings.slice(0, 8),
    recentTransactions: txns.slice(0, 8),
  };
};

module.exports = { ownerIds, enrichUser, enrichOwner, overview };
