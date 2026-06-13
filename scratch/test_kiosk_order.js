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
    console.log('Sending kiosk-like order POST /api/orders...');
    const payload = {
      session_id: 1, 
      items: [
        { name: 'Espresso', price: 60, quantity: 1 }
      ],
      subtotal: 60.0,
      tax: 4.8,
      total: 64.8,
      status: 'To Cook',
      payment_status: 'Paid',
      payment_method: 'UPI QR'
    };

    const res = await postJSON('/api/orders', payload);
    console.log('Response status:', res.status);
    console.log('Response body:', res.body);

    if (res.status === 201) {
      console.log('\nChecking DB row:');
      const sqlite3 = await import('sqlite3');
      const db = new sqlite3.default.Database('backend/pos.db');
      db.get('SELECT * FROM orders WHERE id = ?', [res.body.id], (err, row) => {
        console.log(row);
        db.close();
      });
    }
  } catch (err) {
    console.error(err);
  }
}

run();
