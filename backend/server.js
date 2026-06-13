import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import db from './database.js';

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const JWT_SECRET = 'odoo_cafe_pos_super_secret_key';

app.use(cors());
app.use(express.json());

// --- JWT AUTHENTICATION MIDDLEWARES ---
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : authHeader;
    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        return res.status(403).json({ error: 'Forbidden: Invalid or expired token' });
      }
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ error: 'Unauthorized: Access token missing' });
  }
};

const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied: insufficient permissions' });
    }
    next();
  };
};


// --- 1. SESSIONS API ---
app.get('/api/sessions/active', authenticateJWT, (req, res) => {
  db.get("SELECT * FROM sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1", [], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(row || null);
  });
});

app.post('/api/sessions/open', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
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

app.post('/api/sessions/close', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
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

app.get('/api/sessions/summary/:id', authenticateJWT, (req, res) => {
  const sessionId = req.params.id;
  db.get(`SELECT * FROM sessions WHERE id = ?`, [sessionId], (err, session) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get(`SELECT SUM(total) as total_sales, COUNT(*) as order_count FROM orders WHERE session_id = ? AND status = 'Paid'`, [sessionId], (err, sales) => {
      res.json({
        session,
        totalSales: sales?.total_sales || 0.0,
        orderCount: sales?.order_count || 0
      });
    });
  });
});

// --- 2. CATEGORIES API (Name, Color) ---
app.get('/api/categories', (req, res) => {
  db.all('SELECT * FROM categories', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/categories', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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

app.put('/api/categories/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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

app.delete('/api/categories/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  db.run(`DELETE FROM categories WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- 3. PRODUCTS API ---
app.get('/api/products', (req, res) => {
  db.all('SELECT * FROM products', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/products', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  const { name, price, category, image, description, uom, tax, stock } = req.body;
  db.run(
    `INSERT INTO products (name, price, category, image, description, uom, tax, stock) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, price, category, image, description, uom || 'pcs', tax || 8.0, stock || 50],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: this.lastID, name, price, category, image, description, uom, tax, stock });
    }
  );
});

app.put('/api/products/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  const { name, price, category, image, description, uom, tax, stock } = req.body;
  db.run(
    `UPDATE products SET name = ?, price = ?, category = ?, image = ?, description = ?, uom = ?, tax = ?, stock = ? WHERE id = ?`,
    [name, price, category, image, description, uom, tax, stock, req.params.id],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ id: req.params.id, name, price, category, image, description, uom, tax, stock });
    }
  );
});

app.delete('/api/products/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  db.run(`DELETE FROM products WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- 4. PAYMENT METHODS API ---
app.get('/api/payment-methods', (req, res) => {
  db.all('SELECT * FROM payment_methods', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.put('/api/payment-methods/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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

// --- 5. TABLES & FLOOR PLAN API ---
app.get('/api/tables', (req, res) => {
  db.all('SELECT * FROM tables', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/tables', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
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

app.put('/api/tables/:id', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
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

// --- 6. COUPONS & PROMOTIONS API ---
app.get('/api/coupons', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  db.all('SELECT * FROM coupons', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/coupons', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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

app.get('/api/coupons/validate/:code', (req, res) => {
  db.get('SELECT * FROM coupons WHERE code = ? AND active = 1', [req.params.code], (err, row) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!row) return res.status(404).json({ error: 'Invalid or inactive coupon code' });
    res.json(row);
  });
});

app.get('/api/promotions', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  db.all('SELECT * FROM promotions', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/promotions', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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

app.put('/api/promotions/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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

// --- 7. CUSTOMERS API ---
app.get('/api/customers', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
  db.all('SELECT * FROM customers', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/customers', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
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

// --- 8. EMPLOYEE / USER MANAGEMENT ---
app.get('/api/employees', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  db.all('SELECT id, name, username, role, archived FROM users', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});

app.post('/api/employees', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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

app.put('/api/employees/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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

      for (const [sid, s] of activeSockets.entries()) {
        if (s.user && s.user.username === targetUsername) {
          s.emit('force_logout', { message: 'Your account status or password has been updated by an administrator.' });
          s.disconnect(true);
        }
      }

      res.json({ success: true });
    });
  });
});

app.delete('/api/employees/:id', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  db.run(`DELETE FROM users WHERE id = ?`, [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

// --- 9. POS ORDERS & KITCHEN SYSTEM ---

// Get all orders (including draft and KDS active orders)
app.get('/api/orders', (req, res) => {
  db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    const formatted = rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
    res.json(formatted);
  });
});

// Create/Draft Order
app.post('/api/orders', (req, res) => {
  const { session_id, table_id, customer_id, items, subtotal, tax, discount_amount, total, status, payment_method } = req.body;
  const itemsJson = JSON.stringify(items);
  const createdAt = new Date().toISOString();

  db.serialize(() => {
    db.run(
      `INSERT INTO orders (session_id, table_id, customer_id, items, subtotal, tax, discount_amount, total, status, payment_method, created_at) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [session_id || 1, table_id, customer_id, itemsJson, subtotal, tax, discount_amount || 0.0, total, status || 'Draft', payment_method, createdAt],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        const newOrderId = this.lastID;

        // If table is linked, update table status
        if (table_id) {
          const tableStatus = status === 'Paid' ? 'Inactive' : 'Active';
          const linkedOrderId = status === 'Paid' ? null : newOrderId;
          db.run(`UPDATE tables SET status = ?, active_order_id = ? WHERE id = ?`, [tableStatus, linkedOrderId, table_id]);
        }

        // Decrement stock if Paid
        if (status === 'Paid') {
          items.forEach((item) => {
            db.run(
              `UPDATE products SET stock = MAX(0, stock - ?) WHERE name = ?`,
              [item.quantity, item.name],
              (updateErr) => {
                if (updateErr) console.error(updateErr);
                db.get(`SELECT name, stock FROM products WHERE name = ?`, [item.name], (err, product) => {
                  if (product && product.stock <= 10) {
                    io.emit('inventory_alert', { name: product.name, stock: product.stock });
                  }
                });
              }
            );
          });
        }

        const createdOrder = {
          id: newOrderId,
          session_id,
          table_id,
          customer_id,
          items,
          subtotal,
          tax,
          discount_amount,
          total,
          status: status || 'Draft',
          payment_method,
          created_at: createdAt
        };

        io.emit('new_order', createdOrder);
        res.status(201).json(createdOrder);
      }
    );
  });
});

// Update Order status / Edit Order
app.put('/api/orders/:id', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
  const { status, items, subtotal, tax, discount_amount, total, payment_method } = req.body;
  const id = req.params.id;

  if (items) {
    const itemsJson = JSON.stringify(items);
    db.run(
      `UPDATE orders SET items = ?, subtotal = ?, tax = ?, discount_amount = ?, total = ?, status = ?, payment_method = ? WHERE id = ?`,
      [itemsJson, subtotal, tax, discount_amount, total, status, payment_method, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Sync table status
        db.get(`SELECT table_id FROM orders WHERE id = ?`, [id], (err, order) => {
          if (order && order.table_id) {
            const tableStatus = status === 'Paid' ? 'Inactive' : 'Active';
            const linkedOrderId = status === 'Paid' ? null : id;
            db.run(`UPDATE tables SET status = ?, active_order_id = ? WHERE id = ?`, [tableStatus, linkedOrderId, order.table_id]);
          }
        });

        // Decrement stock if Paid
        if (status === 'Paid') {
          items.forEach((item) => {
            db.run(`UPDATE products SET stock = MAX(0, stock - ?) WHERE name = ?`, [item.quantity, item.name]);
          });
        }

        io.emit('order_updated', { id: parseInt(id), status });
        res.json({ success: true });
      }
    );
  } else {
    // Basic status update (e.g. KDS/Payment confirmation)
    db.run(
      `UPDATE orders SET status = ? WHERE id = ?`,
      [status, id],
      function (err) {
        if (err) return res.status(500).json({ error: err.message });
        
        // Sync table status
        db.get(`SELECT table_id, items FROM orders WHERE id = ?`, [id], (err, order) => {
          if (order) {
            if (order.table_id) {
              const tableStatus = status === 'Paid' ? 'Inactive' : 'Active';
              const linkedOrderId = status === 'Paid' ? null : id;
              db.run(`UPDATE tables SET status = ?, active_order_id = ? WHERE id = ?`, [tableStatus, linkedOrderId, order.table_id]);
            }
            if (status === 'Paid' && order.items) {
              const parsedItems = JSON.parse(order.items);
              parsedItems.forEach((item) => {
                db.run(`UPDATE products SET stock = MAX(0, stock - ?) WHERE name = ?`, [item.quantity, item.name]);
              });
            }
          }
        });

        io.emit('order_updated', { id: parseInt(id), status });
        res.json({ success: true });
      }
    );
  }
});

// Send order to Kitchen Display System (sets order status to 'Draft-Kitchen' or 'Kitchen')
app.post('/api/orders/:id/kitchen', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
  const { id } = req.params;
  db.run(`UPDATE orders SET status = 'To Cook' WHERE id = ?`, [id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    
    db.get(`SELECT * FROM orders WHERE id = ?`, [id], (err, order) => {
      if (order) {
        const formatted = { ...order, items: JSON.parse(order.items) };
        io.emit('kitchen_order', formatted);
      }
    });
    
    res.json({ success: true });
  });
});

// Update order stage in Kitchen (To Cook -> Preparing -> Completed)
app.put('/api/orders/:id/kitchen-stage', (req, res) => {
  const { stage } = req.body; // 'Preparing' or 'Completed'
  const { id } = req.params;
  db.run(`UPDATE orders SET status = ? WHERE id = ?`, [stage, id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    io.emit('kitchen_stage_updated', { id: parseInt(id), stage });
    res.json({ success: true });
  });
});

// Get dashboard statistics
app.get('/api/dashboard/stats', authenticateJWT, authorizeRoles('manager'), (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  db.all(`SELECT * FROM orders WHERE status = 'Paid' AND created_at LIKE ?`, [`${today}%`], (err, ordersRows) => {
    if (err) return res.status(500).json({ error: err.message });
    const todaySales = ordersRows.reduce((sum, o) => sum + o.total, 0.0);
    const ordersToday = ordersRows.length;
    
    const productCounts = {};
    ordersRows.forEach(o => {
      try {
        const items = JSON.parse(o.items);
        items.forEach(item => {
          productCounts[item.name] = (productCounts[item.name] || 0) + item.quantity;
        });
      } catch (e) {}
    });
    
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
        stockAlerts: stockRows
      });
    });
  });
});

// Mock Email Receipt
app.post('/api/orders/:id/email-receipt', (req, res) => {
  const { email } = req.body;
  res.json({ success: true, message: `Receipt for order #${req.params.id} sent to ${email}` });
});

// --- 10. REPORTING & ANALYTICS ---
app.post('/api/reports/dashboard', authenticateJWT, authorizeRoles('manager'), (req, res) => {
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
    // Default fallback
    dateFilter = '1=1';
  }

  let employeeFilter = employeeId ? `AND session_id IN (SELECT id FROM sessions)` : ''; 
  let productFilter = ''; // Evaluated in javascript aggregate below

  const query = `
    SELECT * FROM orders 
    WHERE status = 'Paid' AND ${dateFilter} ${employeeFilter}
  `;

  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });

    const formattedRows = rows.map(r => ({ ...r, items: JSON.parse(r.items) }));
    
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

// --- JWT AUTH LOGIN & SIGNUP ---
app.post('/api/auth/signup', (req, res) => {
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

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  // Support email or username
  db.get('SELECT * FROM users WHERE username = ? OR username = ?', [username, username.split('@')[0]], (err, user) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (user.archived) return res.status(403).json({ error: 'Account archived' });

    const valid = bcrypt.compareSync(password, user.password);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = jwt.sign({ id: user.id, username: user.username, role: user.role, name: user.name }, JWT_SECRET);
    res.json({ token, role: user.role, username: user.username, name: user.name });
  });
});

// Socket.io Connection
const activeSockets = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers['authorization'];
  if (!token) {
    socket.user = { role: 'guest', username: 'anonymous' };
    return next();
  }
  const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
  jwt.verify(cleanToken, JWT_SECRET, (err, decoded) => {
    if (err) {
      return next(new Error('Authentication error: Invalid or expired token'));
    }
    socket.user = decoded;
    next();
  });
});

io.on('connection', (socket) => {
  console.log(`KDS / POS connection active (${socket.user?.role}):`, socket.id);
  activeSockets.set(socket.id, socket);
  
  socket.on('disconnect', () => {
    console.log('Connection closed:', socket.id);
    activeSockets.delete(socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
