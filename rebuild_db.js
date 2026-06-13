import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.resolve(__dirname, 'backend', 'pos.db');

console.log("Connecting to SQLite database at:", dbPath);
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("Database connection error:", err);
    process.exit(1);
  }
  
  db.serialize(() => {
    console.log("Dropping tables...");
    const tablesToDrop = [
      'users',
      'categories',
      'products',
      'payment_methods',
      'tables',
      'coupons',
      'promotions',
      'customers',
      'sessions',
      'orders'
    ];
    tablesToDrop.forEach((table) => {
      db.run(`DROP TABLE IF EXISTS ${table}`, (err) => {
        if (err) console.error(`Error dropping ${table} table:`, err);
      });
    });
    
    console.log("Re-initializing tables and seeding data...");
    db.close(async () => {
      // Import database.js to run the table creations and seeders
      try {
        const { dbReady } = await import('./backend/database.js');
        if (dbReady) {
          await dbReady;
        }
        console.log("SQLite database rebuilt and seeded successfully!");
        process.exit(0);
      } catch (importErr) {
        console.error("Failed to import database.js for initialization:", importErr);
        process.exit(1);
      }
    });
  });
});
