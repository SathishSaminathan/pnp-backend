const { publicUser } = require('../utils');
const { publicTransaction, publicBooking } = require('./payments');
const { summarizeTransactions } = require('./earnings');
const { rewritePhotoList, mapReview } = require('./uploads');
const { paginateItems, withMeta, searchMatch, parseFlag, uniqueSorted, inDateRange, queryString } = require('./query');

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
  const profile = enrichUser(user, db);
  return {
    ...profile,
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
    recentBookings: db.bookings.map(publicBooking).slice(0, 8),
    recentTransactions: txns.slice(0, 8),
  };
};

const listUsers = (db, query = {}) => {
  const search = query.search;
  const role = queryString(query, 'role').toLowerCase();
  const blocked = parseFlag(query.blocked);
  const city = queryString(query, 'city').toLowerCase();
  const enriched = (db.users || []).map(user => enrichUser(user, db));

  const items = enriched.filter(user => {
    if (!searchMatch(search, [user.name, user.phone, user.city, user.role, user.id])) return false;
    if (role && String(user.role || '').toLowerCase() !== role) return false;
    if (blocked !== undefined && Boolean(user.blocked) !== blocked) return false;
    if (city && String(user.city || '').toLowerCase() !== city) return false;
    return true;
  });

  return withMeta(paginateItems(items, query), {
    cities: uniqueSorted(enriched.map(user => user.city)),
  });
};

const listOwners = (db, query = {}) => {
  const ids = ownerIds(db);
  const search = query.search;
  const blocked = parseFlag(query.blocked);
  const city = queryString(query, 'city').toLowerCase();
  const enriched = (db.users || []).filter(user => ids.has(user.id)).map(user => enrichOwner(user, db));

  const items = enriched.filter(user => {
    if (!searchMatch(search, [user.name, user.phone, user.city, user.id])) return false;
    if (blocked !== undefined && Boolean(user.blocked) !== blocked) return false;
    if (city && String(user.city || '').toLowerCase() !== city) return false;
    return true;
  });

  return withMeta(paginateItems(items, query), {
    cities: uniqueSorted(enriched.map(user => user.city)),
  });
};

const listListings = (db, query = {}) => {
  const ownerId = queryString(query, 'ownerId');
  const search = query.search;
  const verifiedFilter = queryString(query, 'verified').toLowerCase();
  const availability = queryString(query, 'availability');
  const category = queryString(query, 'category').toLowerCase();
  const city = queryString(query, 'city').toLowerCase();
  const enabled = parseFlag(query.enabled);
  const ownerBlocked = parseFlag(query.ownerBlocked);

  const scoped = (db.toilets || [])
    .filter(item => (!ownerId ? true : item.ownerId === ownerId))
    .map(toilet => mapAdminListing(toilet, db));

  const items = scoped.filter(item => {
    if (verifiedFilter === 'true' || verifiedFilter === 'verified') {
      if (!item.verified) return false;
    } else if (verifiedFilter === 'false' || verifiedFilter === 'pending' || verifiedFilter === 'unverified') {
      if (item.verified) return false;
    }
    if (availability && String(item.availability || '') !== availability) return false;
    if (category && String(item.category || '').toLowerCase() !== category) return false;
    if (city && String(item.address?.city || '').toLowerCase() !== city) return false;
    if (enabled !== undefined && Boolean(item.enabled !== false) !== enabled) return false;
    if (ownerBlocked !== undefined && Boolean(item.ownerBlocked || item.owner?.blocked) !== ownerBlocked) return false;
    if (!searchMatch(search, [
      item.name,
      item.owner?.name,
      item.owner?.phone,
      item.address?.city,
      item.address?.area,
      item.category,
    ])) return false;
    return true;
  });

  return withMeta(paginateItems(items, query), {
    cities: uniqueSorted(scoped.map(item => item.address?.city)),
    categories: uniqueSorted(scoped.map(item => item.category)),
    availability: uniqueSorted(scoped.map(item => item.availability)),
  });
};

const listBookings = (db, query = {}) => {
  const search = query.search;
  const status = queryString(query, 'status').toUpperCase();
  const paymentStatus = queryString(query, 'paymentStatus').toUpperCase();
  const fromDate = queryString(query, 'fromDate');
  const toDate = queryString(query, 'toDate');

  const items = (db.bookings || [])
    .map(publicBooking)
    .map(booking => ({
      ...booking,
      user: publicUser(
        db.users.find(user => user.id === booking.userId) || {
          id: booking.userId,
          phone: '',
          name: 'Unknown',
          city: '',
          profileCompleted: false,
          favoriteToiletIds: [],
        },
      ),
    }))
    .filter(item => {
      if (status && String(item.bookingStatus || '').toUpperCase() !== status) return false;
      if (paymentStatus && String(item.paymentStatus || '').toUpperCase() !== paymentStatus) return false;
      if (!inDateRange(item.date, fromDate, toDate)) return false;
      if (!searchMatch(search, [
        item.id,
        item.toiletName,
        item.toiletId,
        item.user?.name,
        item.user?.phone,
        item.userId,
      ])) return false;
      return true;
    });

  return paginateItems(items, query);
};

const listTransactions = (db, query = {}) => {
  const search = query.search;
  const settlementStatus = queryString(query, 'settlementStatus').toUpperCase();
  const paymentStatus = queryString(query, 'paymentStatus').toUpperCase();
  const ownerId = queryString(query, 'ownerId');
  const fromDate = queryString(query, 'fromDate');
  const toDate = queryString(query, 'toDate');

  const items = (db.transactions || [])
    .map(txn => ({
      ...publicTransaction(txn),
      owner: publicUser(
        db.users.find(user => user.id === txn.ownerId) || {
          id: txn.ownerId,
          phone: '',
          name: 'Unknown',
          city: '',
          profileCompleted: false,
          favoriteToiletIds: [],
        },
      ),
    }))
    .filter(item => {
      if (ownerId && item.ownerId !== ownerId) return false;
      if (settlementStatus && String(item.settlementStatus || '').toUpperCase() !== settlementStatus) return false;
      if (paymentStatus && String(item.paymentStatus || '').toUpperCase() !== paymentStatus) return false;
      if (!inDateRange(item.createdAt || item.date, fromDate, toDate)) return false;
      if (!searchMatch(search, [
        item.id,
        item.toiletName,
        item.bookingId,
        item.owner?.name,
        item.owner?.phone,
        item.ownerId,
        item.city,
      ])) return false;
      return true;
    });

  return paginateItems(items, query);
};

const listReviews = (db, query = {}) => {
  const search = query.search;
  const minRating = Number(query.minRating);
  const rating = Number(query.rating);
  const toiletId = queryString(query, 'toiletId');

  const items = (db.reviews || [])
    .map(review => ({
      ...mapReview(review),
      toiletName: db.toilets.find(item => item.id === review.toiletId)?.name || '',
      user: publicUser(db.users.find(item => item.id === review.userId) || { name: review.userName || '', photoUrl: '' }),
    }))
    .filter(item => {
      if (toiletId && item.toiletId !== toiletId) return false;
      if (Number.isFinite(rating) && rating > 0 && Math.round(Number(item.rating || 0)) !== rating) return false;
      if (Number.isFinite(minRating) && minRating > 0 && Number(item.rating || 0) < minRating) return false;
      if (!searchMatch(search, [item.userName, item.user?.name, item.toiletName, item.comment, item.toiletId])) return false;
      return true;
    });

  return paginateItems(items, query);
};

module.exports = {
  ownerIds,
  enrichUser,
  enrichOwner,
  overview,
  mapAdminListing,
  applyListingVerified,
  listUsers,
  listOwners,
  listListings,
  listBookings,
  listTransactions,
  listReviews,
};
