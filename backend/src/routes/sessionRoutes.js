import express from 'express';
import db from '../../database.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

export default function(io) {
  router.get('/sessions/active', authenticateJWT, (req, res) => {
    db.get("SELECT * FROM sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1", [], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(row || null);
    });
  });

  router.post('/sessions/open', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
    const { start_balance } = req.body;
    const opened_at = new Date().toISOString();
    db.run(
      `INSERT INTO sessions (opened_at, start_balance, status) VALUES (?, ?, 'open')`,
      [opened_at, start_balance || 0.0],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: this.lastID, opened_at, start_balance, status: 'open' });
      }
    );
  });

  router.post('/sessions/close', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
    const { id, end_balance } = req.body;
    const closed_at = new Date().toISOString();
    db.run(
      `UPDATE sessions SET closed_at = ?, end_balance = ?, status = 'closed' WHERE id = ?`,
      [closed_at, end_balance, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Update all draft orders of this session to cancelled or draft status
        db.run(`UPDATE orders SET status = 'Cancelled' WHERE session_id = ? AND status = 'Draft'`, [id]);
        
        io.emit('session_closed', { id });
        res.json({ id, closed_at, end_balance, status: 'closed' });
      }
    );
  });

  router.get('/sessions/summary/:id', authenticateJWT, (req, res) => {
    const sessionId = req.params.id;
    db.get(`SELECT * FROM sessions WHERE id = ?`, [sessionId], (err, session) => {
      if (err) return res.status(500).json({ error: err.message });
      db.get(`SELECT SUM(total) as total_sales, COUNT(*) as order_count FROM orders WHERE session_id = ? AND status IN ('Paid', 'To Cook', 'Preparing', 'Completed')`, [sessionId], (err, sales) => {
        res.json({
          session,
          totalSales: sales?.total_sales || 0.0,
          orderCount: sales?.order_count || 0
        });
      });
    });
  });

  return router;
}
