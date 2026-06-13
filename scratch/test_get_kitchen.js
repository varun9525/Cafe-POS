import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('backend/pos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(err);
    return;
  }
  
  db.all("SELECT * FROM orders WHERE status IN ('To Cook', 'Preparing', 'Completed') ORDER BY id DESC", [], (err, orderRows) => {
    if (err) {
      console.error(err);
      db.close();
      return;
    }
    
    db.all('SELECT * FROM order_items', [], (err, itemRows) => {
      if (err) {
        console.error(err);
        db.close();
        return;
      }
      
      const itemsByOrderId = {};
      itemRows.forEach(item => {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        });
      });
      
      const formatted = orderRows.map(order => ({
        ...order,
        items: itemsByOrderId[order.id] || []
      }));
      
      console.log('GET /orders/kitchen simulation output:');
      console.log(JSON.stringify(formatted.slice(0, 3), null, 2));
      db.close();
    });
  });
});
