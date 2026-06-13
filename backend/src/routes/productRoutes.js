import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../database.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = express.Router();

// Helper to decode base64 images and save to public/images folder
const saveUploadedImage = (name, imageBase64) => {
  if (imageBase64 && imageBase64.startsWith('data:image/')) {
    const matches = imageBase64.match(/^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      const type = matches[1];
      const data = matches[2];
      const buffer = Buffer.from(data, 'base64');
      
      let ext = 'png';
      if (type.includes('jpeg') || type.includes('jpg')) ext = 'jpg';
      else if (type.includes('gif')) ext = 'gif';
      else if (type.includes('webp')) ext = 'webp';
      
      const safeName = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_').trim();
      const filename = `${safeName || 'custom'}_${Date.now()}.${ext}`;
      // Note the path difference because of folder nesting in backend/src/routes/
      const publicImagesDir = path.resolve(__dirname, '../../../frontend/public/images');
      
      if (!fs.existsSync(publicImagesDir)) {
        fs.mkdirSync(publicImagesDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(publicImagesDir, filename), buffer);
      return `/images/${filename}`;
    }
  }
  return imageBase64;
};

// --- CATEGORIES API ---
router.get('/categories', (req, res) => {
  db.all('SELECT * FROM categories', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/categories', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  const { name, color } = req.body;
  db.run(
    `INSERT INTO categories (name, color) VALUES (?, ?)`,
    [name, color],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, color });
    }
  );
});

router.put('/categories/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  const { name, color } = req.body;
  db.run(
    `UPDATE categories SET name = ?, color = ? WHERE id = ?`,
    [name, color, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: req.params.id, name, color });
    }
  );
});

router.delete('/categories/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  db.run(`DELETE FROM categories WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- PRODUCTS API ---
router.get('/products', (req, res) => {
  db.all('SELECT * FROM products', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

router.post('/products', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  const { name, price, category, image, description, uom, tax, stock } = req.body;
  const finalImagePath = saveUploadedImage(name, image);
  db.run(
    `INSERT INTO products (name, price, category, image, description, uom, tax, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, price, category, finalImagePath, description, uom || 'pcs', tax || 8.0, stock || 50],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, price, category, image: finalImagePath, description, uom, tax, stock });
    }
  );
});

router.put('/products/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  const { name, price, category, image, description, uom, tax, stock } = req.body;
  const finalImagePath = saveUploadedImage(name, image);
  db.run(
    `UPDATE products SET name = ?, price = ?, category = ?, image = ?, description = ?, uom = ?, tax = ?, stock = ? WHERE id = ?`,
    [name, price, category, finalImagePath, description, uom, tax, stock, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: req.params.id, name, price, category, image: finalImagePath, description, uom, tax, stock });
    }
  );
});

router.delete('/products/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

export default router;
