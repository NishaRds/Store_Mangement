// db.js - SQLite database initialization and table setup for StockFlow
const path = require('path');

// Determine database path from environment variable or default to stockflow.db
const dbPath = process.env.DB_PATH || path.join(__dirname, 'stockflow.db');

let db;

try {
  // Attempt to use better-sqlite3
  const BetterSqlite3 = require('better-sqlite3');
  db = new BetterSqlite3(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
} catch (err) {
  // Fall back to Node's built-in SQLite engine (available in Node.js 22+)
  const { DatabaseSync } = require('node:sqlite');
  const nativeDb = new DatabaseSync(dbPath);
  try {
    nativeDb.exec('PRAGMA journal_mode = WAL;');
    nativeDb.exec('PRAGMA foreign_keys = ON;');
  } catch (pErr) {
    // Ignore pragma error if unsupported
  }

  // Adapter providing identical API interface to better-sqlite3
  db = {
    exec: (sql) => nativeDb.exec(sql),
    pragma: (str) => {
      try { nativeDb.exec(`PRAGMA ${str};`); } catch (e) {}
    },
    prepare: (sql) => {
      const stmt = nativeDb.prepare(sql);
      return {
        run: (...params) => {
          const res = stmt.run(...params);
          return {
            changes: res && res.changes !== undefined ? res.changes : 1,
            lastInsertRowid: res && res.lastInsertRowid !== undefined ? res.lastInsertRowid : null
          };
        },
        get: (...params) => stmt.get(...params),
        all: (...params) => stmt.all(...params)
      };
    },
    transaction: (fn) => {
      return (...args) => {
        nativeDb.exec('BEGIN TRANSACTION;');
        try {
          const res = fn(...args);
          nativeDb.exec('COMMIT;');
          return res;
        } catch (txnErr) {
          nativeDb.exec('ROLLBACK;');
          throw txnErr;
        }
      };
    }
  };
}

// Initialize required tables if they don't exist
function initDb() {
  // 1. Users table (owners and staff)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT NOT NULL CHECK(role IN ('owner', 'staff')),
      ownerId INTEGER,
      shopName TEXT,
      ownerName TEXT,
      shopType TEXT,
      ownerPhone TEXT,
      phone TEXT,
      address TEXT,
      pincode TEXT,
      email TEXT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 2. Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      shopId INTEGER NOT NULL,
      name TEXT NOT NULL,
      category TEXT,
      price REAL NOT NULL,
      qty INTEGER NOT NULL,
      lowLimit INTEGER NOT NULL DEFAULT 5,
      expiry TEXT
    );
  `);

  // 3. Customers table
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      shopId INTEGER NOT NULL,
      name TEXT NOT NULL,
      phone TEXT
    );
  `);

  // 4. Sales table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sales (
      id TEXT PRIMARY KEY,
      shopId INTEGER NOT NULL,
      customerId TEXT,
      customerName TEXT,
      customerPhone TEXT,
      items TEXT NOT NULL,
      total REAL NOT NULL,
      staff TEXT,
      date TEXT NOT NULL,
      paid REAL NOT NULL,
      paymentType TEXT NOT NULL,
      payments TEXT NOT NULL
    );
  `);

  // Create indexes for high performance queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_products_shop ON products(shopId);
    CREATE INDEX IF NOT EXISTS idx_customers_shop ON customers(shopId);
    CREATE INDEX IF NOT EXISTS idx_sales_shop ON sales(shopId);
    CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
  `);

  console.log('StockFlow database ready at:', dbPath);
}

initDb();

module.exports = db;
