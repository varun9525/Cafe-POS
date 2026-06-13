import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../../database.js';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'odoo_cafe_pos_super_secret_key';
const router = express.Router();

router.post('/signup', (req, res) => {
  const { name, email, password, role } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  const username = email.split('@')[0];
  const userRole = role || 'customer';

  db.run(
    `INSERT INTO users (name, username, password, role, archived) VALUES (?, ?, ?, ?, 0)`,
    [name, username, hashedPassword, userRole],
    function (err) {
      if (err) return res.status(400).json({ error: 'Email already registered' });
      res.status(201).json({ success: true });
    }
  );
});

router.post('/login', (req, res) => {
  const { username, password, role } = req.body;
  db.get('SELECT * FROM users WHERE username = ? OR username = ?', [username, username.split('@')[0]], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.archived) return res.status(403).json({ error: 'Account archived' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    if (role) {
      let expectedDbRole = '';
      if (role === 'admin') expectedDbRole = 'manager';
      else if (role === 'employee') expectedDbRole = 'cashier';
      else if (role === 'customer') expectedDbRole = 'customer';
      else if (role === 'cook') expectedDbRole = 'cook';

      if (expectedDbRole && user.role !== expectedDbRole) {
        return res.status(401).json({ error: 'Access denied: incorrect credentials for the selected role' });
      }
    }

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET);
    res.json({ token, role: user.role, username: user.username, name: user.name });
  });
});

router.post('/forgot-password', (req, res) => {
  const { usernameOrEmail, newPassword } = req.body;

  if (!usernameOrEmail || !newPassword) {
    return res.status(400).json({ error: 'Username/email and new password are required' });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters long' });
  }

  const normalizedUsername = usernameOrEmail.includes('@')
    ? usernameOrEmail.split('@')[0]
    : usernameOrEmail;

  db.get(
    'SELECT id, archived FROM users WHERE username = ? OR username = ?',
    [usernameOrEmail, normalizedUsername],
    (err, user) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (!user) return res.status(404).json({ error: 'Account not found' });
      if (user.archived) return res.status(403).json({ error: 'Account archived' });

      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      db.run(
        'UPDATE users SET password = ? WHERE id = ?',
        [hashedPassword, user.id],
        function (updateErr) {
          if (updateErr) return res.status(500).json({ error: 'Could not update password' });
          res.json({ success: true, message: 'Password updated successfully' });
        }
      );
    }
  );
});

export default router;
