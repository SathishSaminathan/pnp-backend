const fs = require('fs');
const path = require('path');
const { createSeed } = require('./seed');
const { createDefaultMaster } = require('../constants');
const { query, migrate, ping } = require('./postgres');

const DATA_FILE = path.join(__dirname, '../../data/db.json');

let cache = null;
let writeQueue = Promise.resolve();
let ready = false;

const mergeMaster = db => {
  const defaults = createDefaultMaster();
  if (!db.master || typeof db.master !== 'object') {
    db.master = defaults;
    return db;
  }
  ['categories', 'availability', 'facilities'].forEach(key => {
    if (!Array.isArray(db.master[key]) || !db.master[key].length) {
      db.master[key] = defaults[key];
    }
  });
  return db;
};

const parseFavoriteIds = value => {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const mapUser = row => ({
  id: row.id,
  phone: row.phone,
  name: row.name || '',
  city: row.city || '',
  profileCompleted: Boolean(row.profile_completed),
  favoriteToiletIds: parseFavoriteIds(row.favorite_toilet_ids),
  blocked: Boolean(row.blocked),
  blockedAt: row.blocked_at ? new Date(row.blocked_at).toISOString() : null,
  blockedReason: row.blocked_reason || '',
});

const loadFromPostgres = async () => {
  const [users, toilets, bookings, reviews, notifications, transactions, masterRows, favorites] = await Promise.all([
    query('SELECT * FROM users ORDER BY created_at ASC, id ASC'),
    query('SELECT data FROM toilets'),
    query('SELECT data FROM bookings'),
    query('SELECT data FROM reviews'),
    query('SELECT data FROM notifications'),
    query('SELECT data FROM transactions'),
    query('SELECT key, items FROM master_data'),
    query('SELECT user_id, toilet_id FROM user_favorites ORDER BY created_at ASC'),
  ]);

  const master = createDefaultMaster();
  masterRows.rows.forEach(row => {
    master[row.key] = row.items;
  });

  const favoritesByUser = {};
  favorites.rows.forEach(row => {
    if (!favoritesByUser[row.user_id]) favoritesByUser[row.user_id] = [];
    favoritesByUser[row.user_id].push(row.toilet_id);
  });

  return mergeMaster({
    users: users.rows.map(row => {
      const mapped = mapUser(row);
      if (favoritesByUser[row.id]) {
        mapped.favoriteToiletIds = favoritesByUser[row.id];
      }
      return mapped;
    }),
    toilets: toilets.rows.map(row => row.data),
    bookings: bookings.rows.map(row => row.data),
    reviews: reviews.rows.map(row => row.data),
    notifications: notifications.rows.map(row => row.data),
    transactions: transactions.rows.map(row => row.data),
    master,
  });
};

const replaceJsonRows = async (client, table, rows, columns) => {
  const ids = rows.map(item => item.id).filter(Boolean);
  if (ids.length) {
    await client.query(`DELETE FROM ${table} WHERE NOT (id = ANY($1::text[]))`, [ids]);
  } else {
    await client.query(`DELETE FROM ${table}`);
  }

  for (const row of rows) {
    await columns(client, row);
  }
};

const persistToPostgres = async db => {
  const client = await require('./postgres').getPool().connect();
  try {
    await client.query('BEGIN');

    for (const user of db.users) {
      await client.query(
        `INSERT INTO users (
            id, phone, name, city, profile_completed, favorite_toilet_ids,
            blocked, blocked_at, blocked_reason, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, NOW())
          ON CONFLICT (id) DO UPDATE SET
            phone = EXCLUDED.phone,
            name = EXCLUDED.name,
            city = EXCLUDED.city,
            profile_completed = EXCLUDED.profile_completed,
            favorite_toilet_ids = EXCLUDED.favorite_toilet_ids,
            blocked = EXCLUDED.blocked,
            blocked_at = EXCLUDED.blocked_at,
            blocked_reason = EXCLUDED.blocked_reason,
            updated_at = NOW()`,
        [
          user.id,
          user.phone,
          user.name || '',
          user.city || '',
          Boolean(user.profileCompleted),
          JSON.stringify(user.favoriteToiletIds || []),
          Boolean(user.blocked),
          user.blockedAt || null,
          user.blockedReason || '',
        ],
      );
    }

    await client.query('DELETE FROM user_favorites');

    await replaceJsonRows(client, 'toilets', db.toilets || [], (tx, item) =>
      tx.query(
        `INSERT INTO toilets (id, owner_id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, data = EXCLUDED.data, updated_at = NOW()`,
        [item.id, item.ownerId, JSON.stringify(item)],
      ),
    );

    const favoriteRows = (db.users || []).flatMap(user =>
      (user.favoriteToiletIds || []).map(toiletId => ({ userId: user.id, toiletId })),
    );
    const toiletIds = new Set((db.toilets || []).map(item => item.id));
    for (const row of favoriteRows) {
      if (!toiletIds.has(row.toiletId)) continue;
      await client.query(
        `INSERT INTO user_favorites (user_id, toilet_id, created_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id, toilet_id) DO NOTHING`,
        [row.userId, row.toiletId],
      );
    }

    await replaceJsonRows(client, 'bookings', db.bookings || [], (tx, item) =>
      tx.query(
        `INSERT INTO bookings (id, user_id, toilet_id, data, updated_at)
         VALUES ($1, $2, $3, $4::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, toilet_id = EXCLUDED.toilet_id, data = EXCLUDED.data, updated_at = NOW()`,
        [item.id, item.userId || null, item.toiletId || null, JSON.stringify(item)],
      ),
    );

    await replaceJsonRows(client, 'reviews', db.reviews || [], (tx, item) =>
      tx.query(
        `INSERT INTO reviews (id, toilet_id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET toilet_id = EXCLUDED.toilet_id, data = EXCLUDED.data, updated_at = NOW()`,
        [item.id, item.toiletId || null, JSON.stringify(item)],
      ),
    );

    await replaceJsonRows(client, 'notifications', db.notifications || [], (tx, item) =>
      tx.query(
        `INSERT INTO notifications (id, user_id, data, created_at)
         VALUES ($1, $2, $3::jsonb, COALESCE($4::timestamptz, NOW()))
         ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, data = EXCLUDED.data`,
        [item.id, item.userId || null, JSON.stringify(item), item.createdAt || null],
      ),
    );

    await replaceJsonRows(client, 'transactions', db.transactions || [], (tx, item) =>
      tx.query(
        `INSERT INTO transactions (id, owner_id, data, updated_at)
         VALUES ($1, $2, $3::jsonb, NOW())
         ON CONFLICT (id) DO UPDATE SET owner_id = EXCLUDED.owner_id, data = EXCLUDED.data, updated_at = NOW()`,
        [item.id, item.ownerId || null, JSON.stringify(item)],
      ),
    );

    const userIds = db.users.map(item => item.id);
    if (userIds.length) {
      await client.query(`DELETE FROM users WHERE NOT (id = ANY($1::text[]))`, [userIds]);
    } else {
      await client.query('DELETE FROM users');
    }

    const master = mergeMaster({ master: db.master }).master;
    for (const key of Object.keys(master)) {
      await client.query(
        `INSERT INTO master_data (key, items) VALUES ($1, $2::jsonb)
         ON CONFLICT (key) DO UPDATE SET items = EXCLUDED.items`,
        [key, JSON.stringify(master[key] || [])],
      );
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

const importLegacyJson = () => {
  if (!fs.existsSync(DATA_FILE)) return null;
  try {
    return mergeMaster(JSON.parse(fs.readFileSync(DATA_FILE, 'utf8')));
  } catch {
    return null;
  }
};

const initStore = async () => {
  await migrate();
  const count = await query('SELECT COUNT(*)::int AS count FROM users');
  if (!count.rows[0].count) {
    const imported = importLegacyJson() || mergeMaster(createSeed());
    await persistToPostgres(imported);
    cache = imported;
    console.log(`Postgres seeded with ${imported.users.length} users`);
  } else {
    cache = await loadFromPostgres();
    console.log(`Postgres connected · ${cache.users.length} users`);
  }
  ready = true;
  return cache;
};

const readDb = () => {
  if (!ready || !cache) {
    throw new Error('Database is not ready');
  }
  return cache;
};

const persist = db => {
  cache = db;
  writeQueue = writeQueue.then(() => persistToPostgres(db)).catch(error => {
    console.error('Failed to sync Postgres', error);
  });
  return writeQueue;
};

const updateDb = mutator => {
  const db = readDb();
  const next = mutator(db) || db;
  persist(next);
  return next;
};

const nextId = prefix => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

const isReady = () => ready;

module.exports = {
  initStore,
  readDb,
  updateDb,
  nextId,
  ping,
  isReady,
};
