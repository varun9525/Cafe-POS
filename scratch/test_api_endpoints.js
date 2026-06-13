import http from 'http';

function testEndpoint(path) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3001${path}`, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        console.log(`Endpoint ${path} status: ${res.statusCode}`);
        try {
          const parsed = JSON.parse(data);
          console.log(` - Returned ${Array.isArray(parsed) ? parsed.length : 'object'} items.`);
          if (Array.isArray(parsed) && parsed.length > 0) {
            console.log(` - Sample item keys:`, Object.keys(parsed[0]));
          }
        } catch (e) {
          console.log(` - Response (non-JSON):`, data.slice(0, 100));
        }
        resolve();
      });
    }).on('error', (err) => {
      console.error(`Endpoint ${path} failed:`, err.message);
      resolve();
    });
  });
}

async function run() {
  await testEndpoint('/api/products');
  await testEndpoint('/api/orders/kitchen');
}

run();
