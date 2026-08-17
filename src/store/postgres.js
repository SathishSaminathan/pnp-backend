const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const config = require('../config');

let pool = null;

const getPool = () => {
  if (!config.databaseUrl) {
    throw new Error(
      'DATABASE_URL is required. Start Postgres with `docker compose up -d` in pnp-backend, then set DATABASE_URL in .env',
    );
  }
  if (!pool) {
    pool = new Pool({
      connectionString: config.databaseUrl,
      max: 10,
    });
  }
  return pool;
};

const query = (text, params) => getPool().query(text, params);

const migrate = async () => {
  const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
  await query(sql);
};

const ping = async () => {
  const result = await query('SELECT 1 AS ok');
  return Number(result.rows[0]?.ok) === 1;
};

module.exports = { getPool, query, migrate, ping };
