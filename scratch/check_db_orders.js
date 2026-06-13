import sqlite3 from 'sqlite3';
import path from 'path';

const dbPath = path.resolve('backend/pos.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Connection error:', err);
    return;
  }
  
  db.all('SELECT * FROM orders ORDER BY id DESC LIMIT 15', [], (err, orders) => {
    if (err) {
      console.error(err);
      db.close();
      return;
    }
    console.log(`--- Recent Orders (${orders.length}) ---`);
    orders.forEach(order => {
      console.log(`Order #${order.id} | Status: ${order.status} | PayStatus: ${order.payment_status} | Table: ${order.table_id} | Created: ${order.created_at}`);
    });

    db.all('SELECT * FROM order_items ORDER BY id DESC LIMIT 30', [], (err, items) => {
      if (err) {
        console.error(err);
      } else {
        console.log(`\n--- Recent Order Items (${items.length}) ---`);
        items.forEach(item => {
          console.log(`Item #${item.id} | Order #${item.order_id} | Name: ${item.name} | Price: ${item.price} | Qty: ${item.quantity}`);
        });
      }
      db.close();
    });
  });
});
