import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs';

const dbPath = path.resolve('backend/pos.db');

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  
  db.all('SELECT id, name, image FROM products', [], (err, rows) => {
    if (err) {
      console.error('Query error:', err);
      process.exit(1);
    }
    
    console.log(`Found ${rows.length} products in DB.`);
    
    const remoteUrls = [];
    const localExisting = [];
    const localMissing = [];
    
    rows.forEach(row => {
      const img = row.image;
      if (!img) {
        localMissing.push({ id: row.id, name: row.name, image: img, reason: 'No image path set' });
        return;
      }
      
      if (img.startsWith('http://') || img.startsWith('https://')) {
        remoteUrls.push(row);
      } else {
        const relativePath = img.startsWith('/') ? img.substring(1) : img;
        const diskPath = path.join('frontend/public', relativePath);
        if (fs.existsSync(diskPath)) {
          localExisting.push({ name: row.name, dbPath: img, diskPath });
        } else {
          localMissing.push({ id: row.id, name: row.name, dbPath: img, diskPath });
        }
      }
    });
    
    console.log('\n--- Remote URLs in DB ---');
    console.log(JSON.stringify(remoteUrls, null, 2));
    
    console.log('\n--- Local Existing Images ---');
    console.log(`Count: ${localExisting.length}`);
    
    console.log('\n--- Local Missing Images ---');
    console.log(JSON.stringify(localMissing, null, 2));
    
    db.close();
  });
});
