import express from 'express';
import bcrypt from 'bcryptjs';
import db from '../../database.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

export default function(io, activeSockets) {

  // --- TABLES & FLOOR PLAN ---
  router.get('/tables', (req, res) => {
    db.all('SELECT * FROM tables', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  router.post('/tables', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
    const { table_number, seats, floor } = req.body;
    db.run(
      `INSERT INTO tables (table_number, seats, floor, status) VALUES (?, ?, ?, 'Inactive')`,
      [table_number, seats, floor],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, table_number, seats, floor, status: 'Inactive' });
      }
    );
  });

  router.put('/tables/:id', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
    const { table_number, seats, floor, status, active_order_id } = req.body;
    db.run(
      `UPDATE tables SET table_number = ?, seats = ?, floor = ?, status = ?, active_order_id = ? WHERE id = ?`,
      [table_number, seats, floor, status, active_order_id, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: req.params.id, table_number, seats, floor, status, active_order_id });
      }
    );
  });

  // --- PAYMENT METHODS ---
  router.get('/payment-methods', (req, res) => {
    db.all('SELECT * FROM payment_methods', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  router.put('/payment-methods/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    const { enabled, upi_id } = req.body;
    db.run(
      `UPDATE payment_methods SET enabled = ?, upi_id = ? WHERE id = ?`,
      [enabled ? 1 : 0, upi_id, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: req.params.id, enabled, upi_id });
      }
    );
  });

  // --- COUPONS & PROMOTIONS ---
  router.get('/coupons', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    db.all('SELECT * FROM coupons', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  router.post('/coupons', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    const { code, discount_type, value } = req.body;
    db.run(
      `INSERT INTO coupons (code, discount_type, value, active) VALUES (?, ?, ?, 1)`,
      [code, discount_type, value],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, code, discount_type, value, active: 1 });
      }
    );
  });

  router.get('/coupons/validate/:code', (req, res) => {
    db.get('SELECT * FROM coupons WHERE code = ? AND active = 1', [req.params.code], (err, row) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!row) return res.status(404).json({ error: 'Invalid or inactive coupon code' });
      res.json(row);
    });
  });

  router.get('/promotions', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    db.all('SELECT * FROM promotions', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  router.post('/promotions', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    const { name, type, min_qty, min_amount, discount_type, value, product_id } = req.body;
    db.run(
      `INSERT INTO promotions (name, type, min_qty, min_amount, discount_type, value, product_id, active) VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
      [name, type, min_qty || 0, min_amount || 0.0, discount_type, value, product_id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name, type, min_qty, min_amount, discount_type, value, product_id, active: 1 });
      }
    );
  });

  router.put('/promotions/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    const { active } = req.body;
    db.run(
      `UPDATE promotions SET active = ? WHERE id = ?`,
      [active ? 1 : 0, req.params.id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ id: req.params.id, active });
      }
    );
  });

  // --- CUSTOMERS ---
  router.get('/customers', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
    db.all('SELECT * FROM customers', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  router.post('/customers', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
    const { name, email, phone } = req.body;
    db.run(
      `INSERT INTO customers (name, email, phone) VALUES (?, ?, ?)`,
      [name, email, phone],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name, email, phone });
      }
    );
  });

  // --- EMPLOYEES ---
  router.get('/employees', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    db.all('SELECT id, name, username, role, archived FROM users', [], (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rows);
    });
  });

  router.post('/employees', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    const { name, username, password, role } = req.body;
    const hashedPassword = bcrypt.hashSync(password, 10);
    db.run(
      `INSERT INTO users (name, username, password, role, archived) VALUES (?, ?, ?, ?, 0)`,
      [name, username, hashedPassword, role],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: this.lastID, name, username, role, archived: 0 });
      }
    );
  });

  router.put('/employees/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    const { password, archived, role } = req.body;
    
    db.get('SELECT username FROM users WHERE id = ?', [req.params.id], (err, userRow) => {
      if (err || !userRow) return res.status(404).json({ error: 'User not found' });
      const targetUsername = userRow.username;

      db.serialize(() => {
        if (password) {
          const hashedPassword = bcrypt.hashSync(password, 10);
          db.run(`UPDATE users SET password = ? WHERE id = ?`, [hashedPassword, req.params.id]);
        }
        if (archived !== undefined) {
          db.run(`UPDATE users SET archived = ? WHERE id = ?`, [archived ? 1 : 0, req.params.id]);
        }
        if (role) {
          db.run(`UPDATE users SET role = ? WHERE id = ?`, [role, req.params.id]);
        }

        if (activeSockets) {
          for (const [sid, s] of activeSockets.entries()) {
            if (s.user && s.user.username === targetUsername) {
              s.emit('force_logout', { message: 'Your account status or password has been updated by an administrator.' });
              s.disconnect(true);
            }
          }
        }

        res.json({ success: true });
      });
    });
  });

  router.delete('/employees/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    });
  });

  // --- DASHBOARD STATISTICS ---
  router.get('/dashboard/stats', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    const today = new Date().toISOString().split('T')[0];
    
    const current = new Date();
    const utcYear = current.getUTCFullYear();
    const utcMonth = current.getUTCMonth();
    const utcDate = current.getUTCDate();
    const utcDay = current.getUTCDay();
    
    const dayDiff = utcDay === 0 ? -6 : 1 - utcDay;
    const mondayUTC = new Date(Date.UTC(utcYear, utcMonth, utcDate + dayDiff, 0, 0, 0, 0));
    const mondayStr = mondayUTC.toISOString();

    db.all(
      `SELECT substr(created_at, 1, 10) as order_date, SUM(total) as daily_total 
       FROM orders 
       WHERE status IN ('Paid', 'To Cook', 'Preparing', 'Completed') AND created_at >= ? 
       GROUP BY order_date`,
      [mondayStr],
      (err, weeklyRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const weeklySales = weekDays.map((dayName, index) => {
          const d = new Date(mondayUTC);
          d.setUTCDate(mondayUTC.getUTCDate() + index);
          const dateStr = d.toISOString().split('T')[0];
          const row = weeklyRows ? weeklyRows.find(r => r.order_date === dateStr) : null;
          return {
            day: dayName,
            total: row ? row.daily_total : 0.0
          };
        });

        db.all(`SELECT * FROM orders WHERE status IN ('Paid', 'To Cook', 'Preparing', 'Completed') AND created_at LIKE ?`, [`${today}%`], (err, ordersRows) => {
          if (err) return res.status(500).json({ error: err.message });
          const todaySales = ordersRows.reduce((sum, o) => sum + o.total, 0.0);
          const ordersToday = ordersRows.length;
          
          if (ordersRows.length === 0) {
            db.all(`SELECT * FROM products WHERE stock <= 10`, [], (err, stockRows) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({
                todaySales: 0,
                ordersToday: 0,
                topProduct: { name: 'None', count: 0 },
                stockAlerts: stockRows,
                weeklySales
              });
            });
            return;
          }

          const orderIds = ordersRows.map(o => o.id);
          const placeholders = orderIds.map(() => '?').join(',');

          db.all(`SELECT name, quantity FROM order_items WHERE order_id IN (${placeholders})`, orderIds, (err, itemsRows) => {
            if (err) return res.status(500).json({ error: err.message });

            const productCounts = {};
            if (itemsRows) {
              itemsRows.forEach(item => {
                productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity;
              });
            }
            
            let topProduct = { name: 'None', count: 0 };
            Object.entries(productCounts).forEach(([name, count]) => {
              if (count > topProduct.count) {
                topProduct = { name, count };
              }
            });
            
            db.all(`SELECT * FROM products WHERE stock <= 10`, [], (err, stockRows) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({
                todaySales,
                ordersToday,
                topProduct,
                stockAlerts: stockRows,
                weeklySales
              });
            });
          });
        });
      }
    );
  });

  // --- REPORTING & ANALYTICS ---
  router.post('/reports/dashboard', authenticateJWT, authorizeRoles('manager'), (req, res) => {
    const { period, employeeId, sessionId, productId } = req.body;
    
    let dateFilter = '';
    const today = new Date().toISOString().split('T')[0];
    
    if (period === 'Today') {
      dateFilter = `created_at LIKE '${today}%'`;
    } else if (period === 'This Week') {
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      dateFilter = `created_at >= '${oneWeekAgo}'`;
    } else if (period === 'This Month') {
      const currentMonth = today.slice(0, 7);
      dateFilter = `created_at LIKE '${currentMonth}%'`;
    } else {
      dateFilter = '1=1';
    }

    let employeeFilter = employeeId ? `AND session_id IN (SELECT id FROM sessions)` : ''; 

    const query = `
      SELECT * FROM orders 
      WHERE status IN ('Paid', 'To Cook', 'Preparing', 'Completed') AND ${dateFilter} ${employeeFilter}
    `;

    db.all(query, [], (err, ordersRows) => {
      if (err) return res.status(500).json({ error: err.message });

      if (ordersRows.length === 0) {
        return res.json({
          totalOrders: 0,
          revenue: 0,
          avgOrderValue: 0,
          topOrders: [],
          topProducts: []
        });
      }

      const orderIds = ordersRows.map(o => o.id);
      const placeholders = orderIds.map(() => '?').join(',');

      db.all(`SELECT * FROM order_items WHERE order_id IN (${placeholders})`, orderIds, (err, itemsRows) => {
        if (err) return res.status(500).json({ error: err.message });

        const itemsByOrderId = {};
        itemsRows.forEach(item => {
          if (!itemsByOrderId[item.order_id]) {
            itemsByOrderId[item.order_id] = [];
          }
          itemsByOrderId[item.order_id].push({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          });
        });

        const formattedRows = ordersRows.map(o => ({
          ...o,
          items: itemsByOrderId[o.id] || []
        }));
        
        let filteredOrders = formattedRows;
        if (productId) {
          filteredOrders = formattedRows.filter(order => 
            order.items.some(item => item.name === productId)
          );
        }

        const totalOrders = filteredOrders.length;
        const revenue = filteredOrders.reduce((sum, o) => sum + o.total, 0.0);
        const avgOrderValue = totalOrders > 0 ? (revenue / totalOrders) : 0.0;

        // Aggregate products
        const productSales = {};
        filteredOrders.forEach(order => {
          order.items.forEach(item => {
            if (!productSales[item.name]) {
              productSales[item.name] = { quantity: 0, revenue: 0.0 };
            }
            productSales[item.name].quantity += item.quantity;
            productSales[item.name].revenue += item.price * item.quantity;
          });
        });

        const topProducts = Object.entries(productSales).map(([name, data]) => ({
          name,
          quantitySold: data.quantity,
          revenue: data.revenue
        })).sort((a, b) => b.revenue - a.revenue);

        res.json({
          totalOrders,
          revenue,
          avgOrderValue,
          topOrders: filteredOrders.sort((a,b) => b.total - a.total).slice(0, 5),
          topProducts: topProducts.slice(0, 5)
        });
      });
    });
  });

  // Mock Email Receipt
  router.post('/orders/:id/email-receipt', (req, res) => {
    res.json({ success: true, message: `Receipt for order #${req.params.id} sent to ${req.body.email}` });
  });

  return router;
}
