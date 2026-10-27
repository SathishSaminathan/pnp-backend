const { HttpError } = require('../utils');
const { nextId } = require('../store/db');
const { paginateItems, searchMatch, parseFlag } = require('./query');

const MASTER_KEYS = ['categories', 'availability', 'facilities'];

const sortItems = items =>
  [...(items || [])].sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));

const publicMaster = db => {
  const master = db.master || {};
  return {
    categories: sortItems(master.categories).filter(item => item.active !== false),
    availability: sortItems(master.availability).filter(item => item.active !== false),
    facilities: sortItems(master.facilities).filter(item => item.active !== false),
  };
};

const adminMaster = db => ({
  categories: sortItems(db.master?.categories),
  availability: sortItems(db.master?.availability),
  facilities: sortItems(db.master?.facilities),
});

const listMaster = (db, type, query = {}) => {
  assertKey(type);
  const search = query.search;
  const active = parseFlag(query.active);
  const items = sortItems(db.master?.[type]).filter(item => {
    if (!searchMatch(search, [item.label, item.value, item.id])) return false;
    if (active !== undefined && Boolean(item.active !== false) !== active) return false;
    return true;
  });
  return paginateItems(items, query);
};

const facilityValues = db => publicMaster(db).facilities.map(item => item.value);

const assertKey = key => {
  if (!MASTER_KEYS.includes(key)) {
    throw new HttpError(400, 'Unknown master data type');
  }
};

const normalizeItem = (key, payload, existing = {}) => {
  const value = String(payload.value || payload.label || '').trim();
  const label = String(payload.label || payload.value || '').trim();
  if (!value || !label) {
    throw new HttpError(400, 'Value and label are required');
  }

  const item = {
    ...existing,
    id: existing.id || payload.id || nextId(key.slice(0, 3)),
    value,
    label,
    active: payload.active !== false,
    sortOrder: Number(payload.sortOrder || existing.sortOrder || 0),
  };

  // Optional extras. `icon` is a lucide icon name; `labels` maps language code -> translated label.
  if (payload.icon !== undefined || existing.icon) {
    item.icon = String(payload.icon ?? existing.icon ?? '').trim();
  }
  if (payload.labels !== undefined || existing.labels) {
    const source = payload.labels !== undefined ? payload.labels : existing.labels;
    const labels = {};
    Object.entries(source && typeof source === 'object' ? source : {}).forEach(([lang, text]) => {
      const clean = String(text || '').trim();
      if (/^[a-z]{2}$/i.test(lang) && clean) labels[lang.toLowerCase()] = clean;
    });
    item.labels = labels;
  }

  if (key === 'availability') {
    item.color = payload.color || existing.color || '#6B7280';
    item.bg = payload.bg || existing.bg || '#F3F4F6';
  }

  return item;
};

module.exports = {
  MASTER_KEYS,
  publicMaster,
  adminMaster,
  listMaster,
  facilityValues,
  assertKey,
  normalizeItem,
};
