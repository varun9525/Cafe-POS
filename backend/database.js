import sqlite3 from 'sqlite3';
import bcrypt from 'bcryptjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'pos.db');

export let resolveDbReady;
export let rejectDbReady;
export const dbReady = new Promise((resolve, reject) => {
  resolveDbReady = resolve;
  rejectDbReady = reject;
});

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to database:', err);
    if (rejectDbReady) rejectDbReady(err);
  } else {
    console.log('Connected to SQLite database at:', dbPath);
    initializeDatabase()
      .then(() => { if (resolveDbReady) resolveDbReady(); })
      .catch((initErr) => { if (rejectDbReady) rejectDbReady(initErr); });
  }
});

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Users table
      db.run(`
        CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        archived INTEGER DEFAULT 0
      )
    `);

    // 2. Categories table (Name, Color)
    db.run(`
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        color TEXT NOT NULL
      )
    `);

    // 3. Products table (UOM, Tax, Description, Category ID)
    db.run(`
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price REAL NOT NULL,
        category TEXT NOT NULL,
        image TEXT,
        description TEXT,
        uom TEXT DEFAULT 'pcs',
        tax REAL DEFAULT 8.0,
        stock INTEGER NOT NULL DEFAULT 50
      )
    `);

    // 4. Payment Methods table
    db.run(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        enabled INTEGER DEFAULT 1,
        upi_id TEXT
      )
    `);

    // 5. Tables / Floor Plan table
    db.run(`
      CREATE TABLE IF NOT EXISTS tables (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        table_number TEXT NOT NULL,
        seats INTEGER NOT NULL,
        floor TEXT NOT NULL,
        status TEXT DEFAULT 'Inactive',
        active_order_id INTEGER
      )
    `);

    // 6. Coupons table
    db.run(`
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT UNIQUE NOT NULL,
        discount_type TEXT NOT NULL, -- 'percent' or 'fixed'
        value REAL NOT NULL,
        active INTEGER DEFAULT 1
      )
    `);

    // 7. Promotions table (Automated Promotions)
    db.run(`
      CREATE TABLE IF NOT EXISTS promotions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL, -- 'product' or 'order'
        min_qty INTEGER DEFAULT 0,
        min_amount REAL DEFAULT 0.0,
        discount_type TEXT NOT NULL, -- 'percent' or 'fixed'
        value REAL NOT NULL,
        product_id INTEGER,
        active INTEGER DEFAULT 1
      )
    `);

    // 8. Customers table
    db.run(`
      CREATE TABLE IF NOT EXISTS customers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        phone TEXT
      )
    `);

    // 9. Sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        start_balance REAL NOT NULL,
        end_balance REAL,
        status TEXT NOT NULL -- 'open' or 'closed'
      )
    `);

    // 10. Orders table
    db.run(`
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER,
        table_id INTEGER,
        customer_id INTEGER,
        items TEXT NOT NULL, -- JSON string
        subtotal REAL NOT NULL,
        tax REAL NOT NULL,
        discount_amount REAL DEFAULT 0.0,
        total REAL NOT NULL,
        status TEXT NOT NULL, -- 'Draft', 'Paid', 'Cancelled'
        payment_method TEXT,
        created_at TEXT NOT NULL
      )
    `);

    // --- DATABASE SCHEMA MIGRATIONS (Self-Healing) ---
    db.run("ALTER TABLE products ADD COLUMN uom TEXT DEFAULT 'pcs'", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error products.uom:', err.message);
      }
    });
    db.run("ALTER TABLE products ADD COLUMN tax REAL DEFAULT 8.0", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error products.tax:', err.message);
      }
    });
    db.run("ALTER TABLE products ADD COLUMN stock INTEGER DEFAULT 50", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error products.stock:', err.message);
      }
    });
    db.run("ALTER TABLE tables ADD COLUMN status TEXT DEFAULT 'Inactive'", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error tables.status:', err.message);
      }
    });
    db.run("ALTER TABLE tables ADD COLUMN active_order_id INTEGER", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error tables.active_order_id:', err.message);
      }
    });
    db.run("ALTER TABLE sessions ADD COLUMN status TEXT DEFAULT 'closed'", (err) => {
      if (err && !err.message.includes('duplicate column name')) {
        console.error('Migration error sessions.status:', err.message);
      }
    });

    // --- SEED DATA ---

    // Seed Users
    const hashPassword = (password) => bcrypt.hashSync(password, 10);
    const seedUsers = [
      ['Admin Manager', 'admin', hashPassword('admin123'), 'manager'],
      ['Cashier Staff', 'cashier', hashPassword('cashier123'), 'cashier'],
      ['Customer User', 'customer', hashPassword('customer123'), 'customer']
    ];
    seedUsers.forEach(([name, username, password, role]) => {
      db.run(
        `INSERT OR IGNORE INTO users (name, username, password, role) VALUES (?, ?, ?, ?)`,
        [name, username, password, role]
      );
    });

    // Seed Payment Methods (Required for core checkout system)
    const seedPayments = [
      ['Cash', 1, null],
      ['Digital/Card', 1, null],
      ['UPI QR', 1, 'cafe@ybl']
    ];
    seedPayments.forEach(([name, enabled, upi_id]) => {
      db.run(
        `INSERT OR IGNORE INTO payment_methods (name, enabled, upi_id) VALUES (?, ?, ?)`,
        [name, enabled, upi_id]
      );
    });

    db.run("SELECT 1", (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
});
}

export default db;
