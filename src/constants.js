const FACILITIES = [
  'Water',
  'Hand wash',
  'Soap',
  'Toilet paper',
  'Western toilet',
  'Indian toilet',
  'Wheelchair accessible',
  'Baby changing',
  'Shower',
  'Mirror',
  'Lighting',
  'Lockable',
  'Regular cleaning',
  'Male',
  'Female',
  'Unisex',
];

const BOOKING_STATUS = {
  UPCOMING: 'UPCOMING',
  ACTIVE: 'ACTIVE',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
};

const DISCOVERY_FILTER_DEFAULTS = {
  openNow: false,
  verifiedOnly: false,
  favoritesOnly: false,
  maxPrice: 100,
  minRating: 0,
  maxDistanceKm: 20,
  availability: [],
  categories: [],
  facilities: [],
};

module.exports = {
  FACILITIES,
  BOOKING_STATUS,
  DISCOVERY_FILTER_DEFAULTS,
};
