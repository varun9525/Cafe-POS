import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('backend/pos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err);
  } else {
    db.all('PRAGMA table_info(users)', [], (err, info) => {
      if (err) {
        console.error(err);
      } else {
        console.log('Table columns:', info);
      }
      db.all('SELECT * FROM users', [], (err, rows) => {
        if (err) {
          console.error(err);
        } else {
          console.log('Users in database:', rows);
        }
        db.close();
      });
    });
  }
});

