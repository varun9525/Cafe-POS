import http from 'http';

function postJSON(path, payload) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: 3001,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function run() {
  try {
    console.log('1. Creating draft order...');
    const orderPayload = {
      session_id: 17, // using a active session id found in db
      table_id: 1,
      customer_id: null,
      items: [
        { name: 'Filter Coffee', price: 55, quantity: 2 },
        { name: 'Garlic Bread', price: 60, quantity: 1 }
      ],
      subtotal: 170.0,
      tax: 13.6,
      discount_amount: 0.0,
      total: 183.6,
      status: 'Draft'
    };

    const res1 = await postJSON('/api/orders', orderPayload);
    console.log('Draft order response:', res1);

    if (res1.status === 201) {
      const orderId = res1.body.id;
      console.log(`\n2. Sending order #${orderId} to kitchen...`);
      const res2 = await postJSON(`/api/orders/${orderId}/kitchen`, {});
      console.log('Kitchen transition response:', res2);

      // Verify DB status
      console.log('\n3. Verifying status in SQLite db...');
      const sqlite3 = await import('sqlite3');
      const db = new sqlite3.default.Database('backend/pos.db');
      db.get('SELECT * FROM orders WHERE id = ?', [orderId], (err, row) => {
        console.log('Order row in DB:', row);
        
        // Query order items
        db.all('SELECT * FROM order_items WHERE order_id = ?', [orderId], (err, items) => {
          console.log('Order items in DB:', items);
          db.close();
        });
      });
    }
  } catch (err) {
    console.error('Test run failed:', err);
  }
}

run();
