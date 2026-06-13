import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const outputDir = path.join(__dirname, 'frontend', 'public', 'images');

// Map: local filename -> Unsplash URL
const imageMap = {
  'samosa.jpg': 'https://images.unsplash.com/photo-1601050690597-df056fb4ce78?w=500',
  'potato_wedges.jpg': 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=500',
  'aloo_tikki.jpg': 'https://images.unsplash.com/photo-1589301760014-d929f3979dbc?w=500',
  'nuggets.jpg': 'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?w=500',
  'loaded_fries.jpg': 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=500',
  'filter_coffee.jpg': 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=500',
  'espresso.jpg': 'https://images.unsplash.com/photo-1510707577719-0d859b304910?w=500',
  'americano.jpg': 'https://images.unsplash.com/photo-1551024709-8f23befc6f87?w=500',
  'latte.jpg': 'https://images.unsplash.com/photo-1541167760496-1628856ab772?w=500',
  'cappuccino.jpg': 'https://images.unsplash.com/photo-1572442388796-11668a67e53d?w=500',
  'mocha.jpg': 'https://images.unsplash.com/photo-1578314675249-a6910f80cc4e?w=500',
  'hot_chocolate.jpg': 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?w=500',
  'cold_coffee.jpg': 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=500',
  'cafe_interior.jpg': 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1000',
  'default_coffee.jpg': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=500',
  'default_coffee_large.jpg': 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=1000',
};

function downloadImage(url, filepath) {
  return new Promise((resolve, reject) => {
    const doRequest = (currentUrl, redirectCount = 0) => {
      if (redirectCount > 5) return reject(new Error('Too many redirects'));
      
      https.get(currentUrl, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          return doRequest(response.headers.location, redirectCount + 1);
        }
        if (response.statusCode !== 200) {
          return reject(new Error(`HTTP ${response.statusCode} for ${url}`));
        }
        const fileStream = fs.createWriteStream(filepath);
        response.pipe(fileStream);
        fileStream.on('finish', () => {
          fileStream.close();
          resolve();
        });
        fileStream.on('error', reject);
      }).on('error', reject);
    };
    doRequest(url);
  });
}

async function main() {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const entries = Object.entries(imageMap);
  console.log(`Downloading ${entries.length} images to ${outputDir}...\n`);

  for (const [filename, url] of entries) {
    const filepath = path.join(outputDir, filename);
    if (fs.existsSync(filepath)) {
      console.log(`  ✓ ${filename} (already exists, skipping)`);
      continue;
    }
    try {
      process.stdout.write(`  ↓ Downloading ${filename}...`);
      await downloadImage(url, filepath);
      const stats = fs.statSync(filepath);
      console.log(` done (${(stats.size / 1024).toFixed(0)} KB)`);
    } catch (err) {
      console.log(` FAILED: ${err.message}`);
    }
  }

  console.log('\n✅ All downloads complete!');
}

main();
