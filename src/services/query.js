const parsePagination = (query = {}) => {
  const hasPage = query.page != null && String(query.page).trim() !== '';
  const hasLimit = query.limit != null && String(query.limit).trim() !== '';
  if (!hasPage && !hasLimit) {
    return { page: 1, limit: Number.MAX_SAFE_INTEGER, unpaged: true };
  }
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit, 10) || 10));
  return { page, limit, unpaged: false };
};

const paginateItems = (items = [], query = {}) => {
  const { page, limit, unpaged } = parsePagination(query);
  const total = items.length;
  if (unpaged) {
    return {
      items,
      total,
      page: 1,
      limit: total || 10,
      totalPages: 1,
      meta: {
        pagination: {
          page: 1,
          limit: total || 10,
          total,
          totalRecords: total,
          totalPages: 1,
        },
      },
    };
  }
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * limit;

  return {
    items: items.slice(start, start + limit),
    total,
    page: currentPage,
    limit,
    totalPages,
    meta: {
      pagination: {
        page: currentPage,
        limit,
        total,
        totalRecords: total,
        totalPages,
      },
    },
  };
};

const withMeta = (result, extraMeta = {}) => ({
  ...result,
  meta: {
    ...(result.meta || {}),
    ...extraMeta,
  },
});

const searchMatch = (search, values = []) => {
  const q = String(search || '').trim().toLowerCase();
  if (!q) return true;
  return values.some(value => String(value || '').toLowerCase().includes(q));
};

const parseFlag = value => {
  const raw = String(value ?? '').trim().toLowerCase();
  if (!raw) return undefined;
  if (['true', '1', 'yes'].includes(raw)) return true;
  if (['false', '0', 'no'].includes(raw)) return false;
  return undefined;
};

const uniqueSorted = (values = []) =>
  [...new Set(values.map(value => String(value || '').trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b),
  );

const inDateRange = (dateValue, fromDate, toDate) => {
  if (!fromDate && !toDate) return true;
  const day = String(dateValue || '').slice(0, 10);
  if (!day) return false;
  if (fromDate && day < fromDate) return false;
  if (toDate && day > toDate) return false;
  return true;
};

const queryString = (query, key) => String(query?.[key] || '').trim();

module.exports = {
  parsePagination,
  paginateItems,
  withMeta,
  searchMatch,
  parseFlag,
  uniqueSorted,
  inDateRange,
  queryString,
};
