const fs = require('fs');
const path = require('path');
const { createSeed } = require('./seed');
const { createDefaultMaster } = require('../constants');

const DATA_DIR = path.join(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

let cache = null;
let writeQueue = Promise.resolve();

const mergeMaster = db => {
  const defaults = createDefaultMaster();
  if (!db.master || typeof db.master !== 'object') {
    db.master = defaults;
    return true;
  }

  let changed = false;
  ['categories', 'availability', 'facilities'].forEach(key => {
    if (!Array.isArray(db.master[key]) || !db.master[key].length) {
      db.master[key] = defaults[key];
      changed = true;
    }
  });
  return changed;
};

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
    if (mergeMaster(cache)) {
      persist(cache);
    }
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
