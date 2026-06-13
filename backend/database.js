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

    // Seed Categories
    const seedCategories = [
      ['Starters (Veg)', '#2ec4b6'],
      ['Loaded Fries', '#ff9f1c'],
      ['Hot Coffees', '#714b67'],
      ['Flavoured Coffees', '#e0aaff'],
      ['Cold Coffees', '#90e0ef']
    ];
    seedCategories.forEach(([name, color]) => {
      db.run(
        `INSERT OR IGNORE INTO categories (name, color) VALUES (?, ?)`,
        [name, color]
      );
    });

    // Seed Products
    const seedProducts = [
      // Starters (Veg)
      ['Cheese Corn Samosa (3 Pieces)', 40, 'Starters (Veg)', '/images/samosa.jpg', 'Crispy samosas stuffed with corn and gooey cheese.'],
      ['Cheese Jalapeno Samosa (3 Pieces)', 40, 'Starters (Veg)', '/images/samosa.jpg', 'Samosas with a spicy kick of jalapenos and melted cheese.'],
      ['Cheese Pizza Samosa (3 Pieces)', 40, 'Starters (Veg)', '/images/samosa.jpg', 'Pizza style samosas packed with cheese and Italian seasoning.'],
      ['Crispy Potato Wedges', 40, 'Starters (Veg)', '/images/potato_wedges.jpg', 'Golden brown, seasoned potato wedges.'],
      ['Aloo Masala Tikki (3 Pieces)', 40, 'Starters (Veg)', '/images/aloo_tikki.jpg', 'Traditional spicy potato patties.'],
      ['Tandoori Nuggets (6 Pieces)', 50, 'Starters (Veg)', '/images/nuggets.jpg', 'Crispy nuggets with tandoori spices.'],
      ['Chilli Garlic Potato Popcorn', 50, 'Starters (Veg)', '/images/potato_wedges.jpg', 'Bite-sized potato tots tossed in chili garlic seasoning.'],
      ['Veg Cutlet (2 Pieces)', 50, 'Starters (Veg)', '/images/aloo_tikki.jpg', 'Crispy vegetable patties.'],
      ['Garlic Bread', 60, 'Starters (Veg)', '/images/garlic_bread.png', 'Toasted bread flavored with garlic butter and herbs.'],
      ['French Fries', 70, 'Starters (Veg)', '/images/potato_wedges.jpg', 'Classic salted potato fries.'],
      ['Cheese Garlic Bread', 80, 'Starters (Veg)', '/images/garlic_bread.png', 'Toasted garlic bread loaded with melted mozzarella.'],
      ['Veggie Fingers (7 Pieces)', 80, 'Starters (Veg)', '/images/nuggets.jpg', 'Crispy, breaded mixed vegetable sticks.'],
      ['Potato Cheese Shotz (9 Pieces)', 90, 'Starters (Veg)', '/images/potato_wedges.jpg', 'Bite-sized potato and cheese nuggets.'],

      // Loaded Fries
      ['Spicy Masala French Fries', 80, 'Loaded Fries', '/images/loaded_fries.jpg', 'Fries tossed in spicy masala powder.'],
      ['Cheese Diced French Fries', 90, 'Loaded Fries', '/images/loaded_fries.jpg', 'Loaded fries topped with melted liquid cheese.'],
      ['Chocolicious French Fries', 100, 'Loaded Fries', '/images/loaded_fries.jpg', 'Unique sweet fries topped with chocolate sauce.'],

      // Hot Coffees
      ['Filter Coffee', 55, 'Hot Coffees', '/images/filter_coffee.jpg', 'South Indian style filter coffee.'],
      ['Espresso', 60, 'Hot Coffees', '/images/espresso.jpg', 'Strong, concentrated shot of coffee.'],
      ['Americano', 70, 'Hot Coffees', '/images/americano.jpg', 'Espresso diluted with hot water.'],
      ['Café Latte', 80, 'Hot Coffees', '/images/latte.jpg', 'Espresso with steamed milk and a thin layer of foam.'],
      ['Cappucino', 85, 'Hot Coffees', '/images/cappuccino.jpg', 'Espresso with equal parts steamed milk and foam.'],
      ['Café Mocha', 90, 'Hot Coffees', '/images/mocha.jpg', 'Espresso with hot milk and chocolate.'],
      ['Hot Chocolate', 90, 'Hot Coffees', '/images/hot_chocolate.jpg', 'Rich, creamy chocolate drink.'],
      ['Irish Regular', 90, 'Hot Coffees', '/images/cappuccino.jpg', 'Hot coffee flavored with Irish cream syrup.'],

      // Flavoured Coffees
      ['Hazelnut Coffee', 100, 'Flavoured Coffees', '/images/latte.jpg', 'Coffee infused with premium hazelnut flavor.'],
      ['Vanilla Coffee', 100, 'Flavoured Coffees', '/images/latte.jpg', 'Coffee infused with sweet vanilla syrup.'],
      ['Caramel Coffee', 100, 'Flavoured Coffees', '/images/latte.jpg', 'Coffee infused with rich caramel sauce.'],

      // Cold Coffees
      ['Frappe Chill', 100, 'Cold Coffees', '/images/cold_coffee.jpg', 'Classic chilled blended coffee.'],
      ['Italian Choco Swiss Cold Coffee', 110, 'Cold Coffees', '/images/cold_coffee.jpg', 'Cold coffee with rich Swiss chocolate blend.'],
      ['Café Vanilla Frappe', 120, 'Cold Coffees', '/images/cold_coffee.jpg', 'Blended cold coffee with vanilla extract.'],
      ['Choco Chill Frappe', 120, 'Cold Coffees', '/images/cold_coffee.jpg', 'Rich chocolate-flavored blended cold coffee.'],
      ['Café Cookie Crunch', 130, 'Cold Coffees', '/images/cold_coffee.jpg', 'Cold coffee blended with cookies and cream.'],
      ['Café Caramel Frappe', 130, 'Cold Coffees', '/images/cold_coffee.jpg', 'Cold coffee blended with sweet caramel sauce.'],
      ['Ice Cream Topping', 20, 'Cold Coffees', '/images/cold_coffee.jpg', 'Extra scoop of vanilla ice cream on top.']
    ];
    db.get("SELECT COUNT(*) as count FROM products", [], (err, row) => {
      if (row && row.count === 0) {
        console.log("Seeding products...");
        seedProducts.forEach(([name, price, category, image, description]) => {
          db.run(
            `INSERT INTO products (name, price, category, image, description, uom, tax, stock) VALUES (?, ?, ?, ?, ?, 'pcs', 8.0, 100)`,
            [name, price, category, image, description]
          );
        });
      }

      db.run("SELECT 1", (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
});
}

export default db;
