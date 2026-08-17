CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone VARCHAR(16) NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  profile_completed BOOLEAN NOT NULL DEFAULT FALSE,
  favorite_toilet_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  blocked BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_at TIMESTAMPTZ,
  blocked_reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_phone_idx ON users (phone);
CREATE INDEX IF NOT EXISTS users_blocked_idx ON users (blocked);

CREATE TABLE IF NOT EXISTS toilets (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS toilets_owner_idx ON toilets (owner_id);

CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  toilet_id TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  toilet_id TEXT,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  owner_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  data JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS master_data (
  key TEXT PRIMARY KEY,
  items JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  toilet_id TEXT NOT NULL REFERENCES toilets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, toilet_id)
);

CREATE INDEX IF NOT EXISTS user_favorites_user_idx ON user_favorites (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS user_favorites_toilet_idx ON user_favorites (toilet_id);

INSERT INTO user_favorites (user_id, toilet_id, created_at)
SELECT u.id, fav.id, NOW()
FROM users u
CROSS JOIN LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_typeof(COALESCE(u.favorite_toilet_ids, '[]'::jsonb)) = 'array' THEN u.favorite_toilet_ids
    ELSE '[]'::jsonb
  END
) AS fav(id)
WHERE EXISTS (SELECT 1 FROM toilets t WHERE t.id = fav.id)
ON CONFLICT DO NOTHING;
