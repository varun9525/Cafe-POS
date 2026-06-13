import express from 'express';
import db from '../../database.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

export default function(io) {
  // Get all orders (including draft and KDS active orders)
  router.get('/orders', (req, res) => {
    db.all('SELECT * FROM orders ORDER BY id DESC', [], (err, orderRows) => {
      if (err) return res.status(500).json({ error: err.message });
      
      db.all('SELECT * FROM order_items', [], (err, itemRows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        const itemsByOrderId = {};
        itemRows.forEach(item => {
          if (!itemsByOrderId[item.order_id]) {
            itemsByOrderId[item.order_id] = [];
          }
          itemsByOrderId[item.order_id].push({
            name: item.name,
            price: item.price,
            quantity: item.quantity
          });
        });
        
        const formatted = orderRows.map(order => ({
          ...order,
          items: itemsByOrderId[order.id] || []
        }));
        
        res.json(formatted);
      });
    });
  });

  // Create/Draft Order
  router.post('/orders', (req, res) => {
    const { session_id, table_id, customer_id, items, subtotal, tax, discount_amount, total, status, payment_method } = req.body;
    const createdAt = new Date().toISOString();

    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      db.run(
        `INSERT INTO orders (session_id, table_id, customer_id, items, subtotal, tax, discount_amount, total, status, payment_method, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [session_id || 1, table_id, customer_id, '[]', subtotal, tax, discount_amount || 0.0, total, status || 'Draft', payment_method, createdAt],
        function (err) {
          if (err) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: err.message });
          }
          const newOrderId = this.lastID;

          // Insert order items relationally
          let itemInsertError = null;
          const insertStmt = db.prepare(`INSERT INTO order_items (order_id, name, price, quantity) VALUES (?, ?, ?, ?)`);
          
          items.forEach((item) => {
            insertStmt.run([newOrderId, item.name, item.price, item.quantity], (runErr) => {
              if (runErr) itemInsertError = runErr;
            });
          });

          insertStmt.finalize(() => {
            if (itemInsertError) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: itemInsertError.message });
            }

            // If table is linked, update table status
            if (table_id) {
              const tableStatus = status === 'Paid' ? 'Inactive' : 'Active';
              const linkedOrderId = status === 'Paid' ? null : newOrderId;
              db.run(`UPDATE tables SET status = ?, active_order_id = ? WHERE id = ?`, [tableStatus, linkedOrderId, table_id], (tableErr) => {
                if (tableErr) console.error('Table sync error:', tableErr);
              });
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

            db.run("COMMIT", (commitErr) => {
              if (commitErr) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: commitErr.message });
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
            });
          });
        }
      );
    });
  });

  // Update Order status / Edit Order
  router.put('/orders/:id', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
    const { status, items, subtotal, tax, discount_amount, total, payment_method } = req.body;
    const id = req.params.id;

    if (items) {
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run(
          `UPDATE orders SET subtotal = ?, tax = ?, discount_amount = ?, total = ?, status = ?, payment_method = ? WHERE id = ?`,
          [subtotal, tax, discount_amount, total, status, payment_method, id],
          function (err) {
            if (err) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: err.message });
            }

            // Delete existing items
            db.run(`DELETE FROM order_items WHERE order_id = ?`, [id], (delErr) => {
              if (delErr) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: delErr.message });
              }

              // Insert new items
              let itemInsertError = null;
              const insertStmt = db.prepare(`INSERT INTO order_items (order_id, name, price, quantity) VALUES (?, ?, ?, ?)`);
              
              items.forEach((item) => {
                insertStmt.run([id, item.name, item.price, item.quantity], (runErr) => {
                  if (runErr) itemInsertError = runErr;
                });
              });

              insertStmt.finalize(() => {
                if (itemInsertError) {
                  db.run("ROLLBACK");
                  return res.status(500).json({ error: itemInsertError.message });
                }

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

                db.run("COMMIT", (commitErr) => {
                  if (commitErr) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: commitErr.message });
                  }

                  io.emit('order_updated', { id: parseInt(id), status });
                  res.json({ success: true });
                });
              });
            });
          }
        );
      });
    } else {
      // Basic status update (e.g. KDS/Payment confirmation)
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run(
          `UPDATE orders SET status = ? WHERE id = ?`,
          [status, id],
          function (err) {
            if (err) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: err.message });
            }
            
            // Sync table status
            db.get(`SELECT table_id FROM orders WHERE id = ?`, [id], (err, order) => {
              if (order) {
                if (order.table_id) {
                  const tableStatus = status === 'Paid' ? 'Inactive' : 'Active';
                  const linkedOrderId = status === 'Paid' ? null : id;
                  db.run(`UPDATE tables SET status = ?, active_order_id = ? WHERE id = ?`, [tableStatus, linkedOrderId, order.table_id]);
                }
                if (status === 'Paid') {
                  db.all(`SELECT name, quantity FROM order_items WHERE order_id = ?`, [id], (err, itemsRows) => {
                    if (itemsRows) {
                      itemsRows.forEach((item) => {
                        db.run(`UPDATE products SET stock = MAX(0, stock - ?) WHERE name = ?`, [item.quantity, item.name]);
                      });
                    }
                  });
                }
              }
            });

            db.run("COMMIT", (commitErr) => {
              if (commitErr) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: commitErr.message });
              }

              io.emit('order_updated', { id: parseInt(id), status });
              res.json({ success: true });
            });
          }
        );
      });
    }
  });

  // Send order to Kitchen Display System (sets order status to 'To Cook')
  router.post('/orders/:id/kitchen', authenticateJWT, authorizeRoles('manager', 'cashier'), (req, res) => {
    const { id } = req.params;
    db.run(`UPDATE orders SET status = 'To Cook' WHERE id = ?`, [id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      
      db.get(`SELECT * FROM orders WHERE id = ?`, [id], (err, order) => {
        if (order) {
          db.all(`SELECT name, price, quantity FROM order_items WHERE order_id = ?`, [id], (err, itemsRows) => {
            const formatted = { 
              ...order, 
              items: itemsRows || [] 
            };
            io.emit('kitchen_order', formatted);
          });
        }
      });
      
      res.json({ success: true });
    });
  });

  // Update order stage in Kitchen (To Cook -> Preparing -> Completed)
  router.put('/orders/:id/kitchen-stage', (req, res) => {
    const { stage } = req.body; // 'Preparing' or 'Completed'
    const { id } = req.params;
    db.run(`UPDATE orders SET status = ? WHERE id = ?`, [stage, id], function (err) {
      if (err) return res.status(500).json({ error: err.message });
      io.emit('kitchen_stage_updated', { id: parseInt(id), stage });
      res.json({ success: true });
    });
  });

  return router;
}
