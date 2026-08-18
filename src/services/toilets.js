const { DISCOVERY_FILTER_DEFAULTS } = require('../constants');
const { isBlocked, isOpenNow, parseBounds, parseOrigin, haversineKm, isInBounds, roundKm } = require('../utils');
const { publicMaster } = require('./master');
const { isFavorite } = require('./favorites');
const { rewritePhotoList } = require('./uploads');

const isToiletEnabled = toilet => toilet?.enabled !== false;

const mapEnabledStatus = (toilet, enabled = isToiletEnabled(toilet)) => ({
  id: toilet.id,
  enabled,
  message: enabled ? 'Listing is now visible on the map' : 'Listing is hidden from the map',
});

const mapToilet = (toilet, user, reviews, origin, options = {}) => {
  const computedKm = haversineKm(origin, toilet.coordinates);
  const mapped = {
    ...toilet,
    enabled: isToiletEnabled(toilet),
    isOwner: Boolean(user?.id && toilet.ownerId === user.id),
    isFavorite: isFavorite(user, toilet.id),
    distanceKm: computedKm == null ? Number(toilet.distanceKm || 0) : roundKm(computedKm),
    photos: rewritePhotoList(toilet.photos),
  };
  if (options.includeReviews) {
    mapped.reviews = (reviews || [])
      .filter(review => review.toiletId === toilet.id)
      .map(review => ({ ...review, photos: rewritePhotoList(review.photos || []) }));
  }
  return mapped;
};

const normalizeFilters = filters => ({
  ...DISCOVERY_FILTER_DEFAULTS,
  ...(filters || {}),
  availability: Array.isArray(filters?.availability) ? filters.availability : [],
  categories: Array.isArray(filters?.categories) ? filters.categories : [],
  facilities: Array.isArray(filters?.facilities) ? filters.facilities : [],
});

const listToilets = ({
  db,
  user,
  search = '',
  filters = DISCOVERY_FILTER_DEFAULTS,
  sortBy = 'relevance',
  bounds,
  origin,
  minLat,
  maxLat,
  minLng,
  maxLng,
} = {}) => {
  const query = String(search || '').trim().toLowerCase();
  const normalizedFilters = normalizeFilters(filters);
  const normalizedOrigin = parseOrigin(origin);
  const hasBoundsPayload = Boolean(
    (bounds && typeof bounds === 'object') ||
      [minLat, maxLat, minLng, maxLng].some(value => value != null && value !== ''),
  );
  const normalizedBounds = parseBounds(bounds, { minLat, maxLat, minLng, maxLng });
  if (hasBoundsPayload && !normalizedBounds) return [];

  const mappedToilets = db.toilets
    .filter(toilet => {
      if (!isToiletEnabled(toilet)) return false;
      const owner = db.users.find(item => item.id === toilet.ownerId);
      if (isBlocked(owner)) return false;
      if (normalizedBounds && !isInBounds(toilet.coordinates, normalizedBounds)) return false;
      return true;
    })
    .map(toilet => mapToilet(toilet, user, undefined, normalizedOrigin));

  return mappedToilets
    .filter(toilet => {
      const matchesQuery =
        !query ||
        [toilet.name, toilet.address?.area, toilet.address?.city, ...(toilet.facilities || [])]
          .filter(Boolean)
          .some(value => String(value).toLowerCase().includes(query));

      if (!matchesQuery) return false;
      if (normalizedFilters.favoritesOnly) return toilet.isFavorite;
      if (normalizedFilters.openNow && !isOpenNow(toilet.operatingHours)) return false;
      if (normalizedFilters.verifiedOnly && !toilet.verified) return false;
      if (toilet.basePrice > Number(normalizedFilters.maxPrice || DISCOVERY_FILTER_DEFAULTS.maxPrice)) return false;
      if (toilet.rating < Number(normalizedFilters.minRating || 0)) return false;
      if (!normalizedBounds && toilet.distanceKm > Number(normalizedFilters.maxDistanceKm || DISCOVERY_FILTER_DEFAULTS.maxDistanceKm)) {
        return false;
      }
      if (normalizedFilters.availability.length && !normalizedFilters.availability.includes(toilet.availability)) return false;
      if (normalizedFilters.categories.length && !normalizedFilters.categories.includes(toilet.category)) return false;
      if (normalizedFilters.facilities.length && !normalizedFilters.facilities.every(item => toilet.facilities.includes(item))) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'distance') return a.distanceKm - b.distanceKm;
      if (sortBy === 'price_low') return a.basePrice - b.basePrice;
      if (sortBy === 'price_high') return b.basePrice - a.basePrice;
      if (sortBy === 'rating') return b.rating - a.rating;
      if (normalizedOrigin && a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      if (a.isFavorite !== b.isFavorite) return a.isFavorite ? -1 : 1;
      if (a.verified !== b.verified) return a.verified ? -1 : 1;
      return a.distanceKm - b.distanceKm;
    });
};

const discoveryFilters = db => {
  const master = publicMaster(db);
  const visibleToilets = db.toilets.filter(isToiletEnabled);
  const facilities = master.facilities.map(item => ({
    name: item.value,
    label: item.label,
    count: visibleToilets.filter(toilet => (toilet.facilities || []).includes(item.value)).length,
  }));
  const maxPrice = Math.max(...visibleToilets.map(item => item.basePrice), DISCOVERY_FILTER_DEFAULTS.maxPrice);
  const maxDistanceKm = Math.max(...visibleToilets.map(item => item.distanceKm), DISCOVERY_FILTER_DEFAULTS.maxDistanceKm);

  return {
    defaults: { ...DISCOVERY_FILTER_DEFAULTS, maxPrice, maxDistanceKm },
    options: {
      categories: master.categories.map(item => ({ value: item.value, label: item.label })),
      availability: master.availability.map(item => ({ value: item.value, label: item.label })),
      facilities,
      sortBy: [
        { label: 'Relevance', value: 'relevance' },
        { label: 'Distance', value: 'distance' },
        { label: 'Price: Low to High', value: 'price_low' },
        { label: 'Price: High to Low', value: 'price_high' },
        { label: 'Top Rated', value: 'rating' },
      ],
    },
    quickFilters: [
      { label: 'Open now', patch: { openNow: true } },
      { label: 'Verified', patch: { verifiedOnly: true } },
      { label: 'Under ₹30', patch: { maxPrice: 30 } },
    ],
  };
};

module.exports = { isToiletEnabled, mapEnabledStatus, mapToilet, listToilets, discoveryFilters };
