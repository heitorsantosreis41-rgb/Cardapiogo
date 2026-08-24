// ============================================================
// DB — Armazenamento em arquivo JSON (persistente, sem dependências).
// Estado mantido em memória e persistido atomicamente no disco.
// ============================================================
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DATA_DIR = process.env.CG_DATA_DIR || path.join(__dirname, "..", "..", "data");
const DB_FILE = path.join(DATA_DIR, "db.json");
const DB_SAVED = Symbol("db-saved");

function uuid() {
  return crypto.randomUUID();
}

const DEFAULT_DB = {
  users: [],
  sessions: [],
  restaurants: [],
  categories: [],
  products: [],
  business_hours: [],
  subscriptions: [],
  analytics: [],
  password_resets: [],
  payments: [],
  webhook_events: [],
};

let db = null;
let saveTimer = null;
let dirty = false;

function load() {
  if (db) return db;
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf8");
      const parsed = JSON.parse(raw);
      db = Object.assign({}, DEFAULT_DB, parsed);
    } else {
      db = JSON.parse(JSON.stringify(DEFAULT_DB));
    }
  } catch (e) {
    console.error("Falha ao carregar DB, iniciando novo:", e.message);
    db = JSON.parse(JSON.stringify(DEFAULT_DB));
  }
  // Reconstruir índices por id
  for (const k of Object.keys(DEFAULT_DB)) {
    if (Array.isArray(db[k])) {
      db[k] = db[k].map((row) => {
        row._idx = db[k].indexOf(row);
        return row;
      });
    }
  }
  return db;
}

function flush() {
  if (!dirty || !db) return;
  dirty = false;
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    const clean = {};
    for (const k of Object.keys(DEFAULT_DB)) {
      clean[k] = db[k].map((row) => {
        const c = Object.assign({}, row);
        delete c._db;
        return c;
      });
    }
    const tmp = DB_FILE + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(clean, null, 2));
    fs.renameSync(tmp, DB_FILE);
  } catch (e) {
    console.error("Falha ao salvar DB:", e.message);
    dirty = true;
  }
}

function markDirty() {
  dirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 50);
}

function all(collection) {
  return db[collection] || [];
}

function getById(collection, id) {
  return (db[collection] || []).find((r) => r.id === id) || null;
}

function insert(collection, data) {
  const row = Object.assign({ id: uuid(), created_at: new Date().toISOString() }, data);
  db[collection].push(row);
  markDirty();
  return row;
}

function update(collection, id, patch) {
  const row = getById(collection, id);
  if (!row) return null;
  Object.assign(row, patch, { updated_at: new Date().toISOString() });
  markDirty();
  return row;
}

function remove(collection, id) {
  const i = db[collection].findIndex((r) => r.id === id);
  if (i === -1) return false;
  db[collection].splice(i, 1);
  markDirty();
  return true;
}

function count(collection, predicate) {
  return db[collection].filter(predicate || (() => true)).length;
}

function nowISO() {
  return new Date().toISOString();
}

module.exports = { load, flush, all, insert, getById, update, remove, count, nowISO, uuid, DATA_DIR, DB_FILE };