const fs = require('fs');
const path = require('path');
const { createSeed } = require('./seed');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

let cache = null;
let writeQueue = Promise.resolve();

const ensureStore = () => {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(createSeed(), null, 2));
  }
};

const readDb = () => {
  ensureStore();
  if (!cache) {
    cache = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  }
  return cache;
};

const persist = db => {
  cache = db;
  writeQueue = writeQueue.then(() =>
    fs.promises.writeFile(DATA_FILE, JSON.stringify(db, null, 2)),
  );
  return writeQueue;
};

const updateDb = mutator => {
  const db = readDb();
  const next = mutator(db) || db;
  persist(next);
  return next;
};

const nextId = prefix => `${prefix}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

module.exports = {
  readDb,
  updateDb,
  nextId,
};
