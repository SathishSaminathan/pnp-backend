const { publicUser } = require('../utils');
const { publicTransaction } = require('./payments');
const { summarizeTransactions } = require('./earnings');
const { rewritePhotoList } = require('./uploads');

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

const firstListingPhoto = toilets => {
  for (const toilet of toilets || []) {
    const photo = rewritePhotoList(toilet.photos || [])[0];
    if (photo) return photo;
  }
  return '';
};

const enrichOwner = (user, db) => {
  const toilets = db.toilets.filter(item => item.ownerId === user.id);
  const bookings = db.bookings.filter(item => toilets.some(toilet => toilet.id === item.toiletId));
  const txns = db.transactions.filter(item => item.ownerId === user.id).map(publicTransaction);
  const profile = enrichUser(user, db);
  return {
    ...profile,
    photoUrl: profile.photoUrl || firstListingPhoto(toilets),
    listings: toilets.map(item => ({
      id: item.id,
      name: item.name,
      verified: Boolean(item.verified),
      verifiedAt: item.verifiedAt || null,
      verifiedBy: item.verifiedBy || null,
      enabled: item.enabled !== false,
      availability: item.availability,
      basePrice: item.basePrice,
      rating: item.rating,
      reviewCount: item.reviewCount,
      city: item.address?.city,
      area: item.address?.area,
      address: item.address,
      photos: rewritePhotoList(item.photos),
    })),
    hostBookingCount: bookings.length,
    settledAmount: txns.filter(item => item.settlementStatus === 'SETTLED').reduce((sum, item) => sum + Number(item.netAmount || 0), 0),
  };
};

const mapAdminListing = (toilet, db) => {
  const owner = db.users.find(user => user.id === toilet.ownerId) || {
    id: toilet.ownerId,
    phone: '',
    name: 'Unknown',
    city: '',
    profileCompleted: false,
    favoriteToiletIds: [],
  };
  return {
    ...toilet,
    photos: rewritePhotoList(toilet.photos),
    owner: publicUser(owner),
    ownerBlocked: Boolean(owner.blocked),
    bookingCount: db.bookings.filter(item => item.toiletId === toilet.id).length,
    verified: Boolean(toilet.verified),
    verifiedAt: toilet.verifiedAt || null,
    verifiedBy: toilet.verifiedBy || null,
    verificationNotes: toilet.verificationNotes || '',
  };
};

const applyListingVerified = (toilet, { verified, admin, notes }) => {
  const nextVerified = Boolean(verified);
  return {
    ...toilet,
    verified: nextVerified,
    verifiedAt: nextVerified ? new Date().toISOString() : null,
    verifiedBy: nextVerified ? admin?.email || admin?.id || 'admin' : null,
    verificationNotes: String(notes || '').trim(),
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
    verifiedListings: db.toilets.filter(item => item.verified).length,
    pendingListings: db.toilets.filter(item => !item.verified).length,
    bookings: db.bookings.length,
    reviews: db.reviews.length,
    earnings: summarizeTransactions(txns, { toilets: db.toilets, bookings: db.bookings }),
    recentBookings: db.bookings.slice(0, 8),
    recentTransactions: txns.slice(0, 8),
  };
};

module.exports = { ownerIds, enrichUser, enrichOwner, overview, mapAdminListing, applyListingVerified };
