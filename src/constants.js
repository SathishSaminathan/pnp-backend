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

const createDefaultMaster = () => ({
  categories: [
    { id: 'cat_premium', value: 'Premium', label: 'Premium', active: true, sortOrder: 1 },
    { id: 'cat_public_partner', value: 'Public Partner', label: 'Public Partner', active: true, sortOrder: 2 },
    { id: 'cat_corporate', value: 'Corporate', label: 'Corporate', active: true, sortOrder: 3 },
  ],
  availability: [
    { id: 'avail_available', value: 'AVAILABLE', label: 'Available', color: '#16A34A', bg: '#F0FDF4', active: true, sortOrder: 1 },
    { id: 'avail_held', value: 'TEMPORARILY_HELD', label: 'Held', color: '#F59E0B', bg: '#FFFBEB', active: true, sortOrder: 2 },
    { id: 'avail_maintenance', value: 'MAINTENANCE', label: 'Maintenance', color: '#EF4444', bg: '#FEF2F2', active: true, sortOrder: 3 },
  ],
  facilities: [
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
  ].map((label, index) => ({
    id: `fac_${index + 1}`,
    value: label,
    label,
    active: true,
    sortOrder: index + 1,
  })),
});

const FACILITIES = createDefaultMaster().facilities.map(item => item.value);

module.exports = {
  FACILITIES,
  BOOKING_STATUS,
  DISCOVERY_FILTER_DEFAULTS,
  createDefaultMaster,
};
