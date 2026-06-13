import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('backend/pos.db');

function getLocalImagePath(name) {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('samosa')) {
    return '/images/samosa.jpg';
  }
  if (lowerName.includes('garlic bread')) {
    return '/images/garlic_bread.png';
  }
  if (lowerName.includes('potato wedges') || lowerName.includes('popcorn') || lowerName.includes('french fries') || lowerName.includes('shotz')) {
    if (lowerName.includes('masala') || lowerName.includes('diced') || lowerName.includes('chocolicious')) {
      return '/images/loaded_fries.jpg';
    }
    return '/images/potato_wedges.jpg';
  }
  if (lowerName.includes('tikki') || lowerName.includes('cutlet')) {
    return '/images/aloo_tikki.jpg';
  }
  if (lowerName.includes('nuggets') || lowerName.includes('fingers')) {
    return '/images/nuggets.jpg';
  }
  if (lowerName.includes('filter coffee')) {
    return '/images/filter_coffee.jpg';
  }
  if (lowerName.includes('espresso')) {
    return '/images/espresso.jpg';
  }
  if (lowerName.includes('americano')) {
    return '/images/americano.jpg';
  }
  if (lowerName.includes('latte') || lowerName.includes('hazelnut') || lowerName.includes('vanilla') || lowerName.includes('caramel')) {
    if (lowerName.includes('frappe')) {
      return '/images/cold_coffee.jpg';
    }
    return '/images/latte.jpg';
  }
  if (lowerName.includes('cappucino') || lowerName.includes('cappuccino') || lowerName.includes('irish')) {
    return '/images/cappuccino.jpg';
  }
  if (lowerName.includes('mocha')) {
    return '/images/mocha.jpg';
  }
  if (lowerName.includes('hot chocolate')) {
    return '/images/hot_chocolate.jpg';
  }
  if (lowerName.includes('frappe') || lowerName.includes('cold coffee') || lowerName.includes('cookie') || lowerName.includes('topping')) {
    return '/images/cold_coffee.jpg';
  }
  
  // Fallback to default
  return '/images/default_coffee.jpg';
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Database connection error:', err);
    process.exit(1);
  }
  
  console.log('Connected to SQLite database at:', dbPath);
  
  db.all('SELECT id, name, image FROM products', [], (err, rows) => {
    if (err) {
      console.error('Failed to query products:', err);
      db.close();
      process.exit(1);
    }
    
    console.log(`Analyzing ${rows.length} products...`);
    
    db.serialize(() => {
      const stmt = db.prepare('UPDATE products SET image = ? WHERE id = ?');
      let updatedCount = 0;
      
      rows.forEach((row) => {
        const localPath = getLocalImagePath(row.name);
        if (row.image !== localPath) {
          stmt.run(localPath, row.id);
          console.log(`  → Updated: "${row.name}" image path: "${row.image}" → "${localPath}"`);
          updatedCount++;
        }
      });
      
      stmt.finalize((finalizeErr) => {
        if (finalizeErr) {
          console.error('Error finalizing statement:', finalizeErr);
        }
        console.log(`\nMigration complete! Updated ${updatedCount} products.`);
        db.close();
      });
    });
  });
});
