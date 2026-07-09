/**
 * agentChat.js — IBM Granite Tool-Calling Agent for Café Manager
 *
 * POST /api/agent/chat
 * Body: { message: string, history?: [{role, content}] }
 *
 * The agent is given 5 tools. It calls watsonx.ai (Granite) with tool
 * definitions, executes whichever tool(s) Granite requests against the local
 * SQLite database, feeds results back, then returns Granite's final answer.
 */

import express from 'express';
import db from '../../database.js';
import { authenticateJWT, authorizeRoles } from '../middleware/auth.js';

const router = express.Router();

// ---------------------------------------------------------------------------
// Helper: promisified db.all / db.get
// ---------------------------------------------------------------------------
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

// ---------------------------------------------------------------------------
// Tool Implementations  (each returns a plain JS object / array)
// ---------------------------------------------------------------------------

async function getSalesSummary({ date_range = 'today' } = {}) {
  const today = new Date().toISOString().split('T')[0];
  let startDate, label;

  if (date_range === 'today') {
    startDate = today;
    label = 'Today';
  } else if (date_range === 'yesterday') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    startDate = d.toISOString().split('T')[0];
    label = 'Yesterday';
  } else if (date_range === 'week') {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    startDate = d.toISOString().split('T')[0];
    label = 'Last 7 days';
  } else if (date_range === 'month') {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    startDate = d.toISOString().split('T')[0];
    label = 'Last 30 days';
  } else {
    startDate = today;
    label = 'Today';
  }

  const [summary, topItems, paymentBreakdown] = await Promise.all([
    dbGet(
      `SELECT COUNT(*) as order_count, COALESCE(SUM(total),0) as revenue,
              COALESCE(SUM(discount_amount),0) as total_discounts,
              COALESCE(AVG(total),0) as avg_order_value
       FROM orders
       WHERE payment_status = 'Paid' AND created_at >= ?`,
      [startDate + 'T00:00:00.000Z']
    ),
    dbAll(
      `SELECT oi.name, SUM(oi.quantity) as units_sold,
              SUM(oi.price * oi.quantity) as revenue
       FROM order_items oi
       JOIN orders o ON oi.order_id = o.id
       WHERE o.payment_status = 'Paid' AND o.created_at >= ?
       GROUP BY oi.name ORDER BY units_sold DESC LIMIT 5`,
      [startDate + 'T00:00:00.000Z']
    ),
    dbAll(
      `SELECT payment_method, COUNT(*) as count, COALESCE(SUM(total),0) as total
       FROM orders
       WHERE payment_status = 'Paid' AND created_at >= ?
       GROUP BY payment_method`,
      [startDate + 'T00:00:00.000Z']
    )
  ]);

  return {
    period: label,
    revenue: parseFloat(summary.revenue.toFixed(2)),
    order_count: summary.order_count,
    avg_order_value: parseFloat(summary.avg_order_value.toFixed(2)),
    total_discounts: parseFloat(summary.total_discounts.toFixed(2)),
    top_items: topItems,
    payment_breakdown: paymentBreakdown
  };
}

async function getTableStatus() {
  const tables = await dbAll(`SELECT * FROM tables ORDER BY floor, table_number`);
  const active = tables.filter(t => t.status === 'Active');
  const inactive = tables.filter(t => t.status === 'Inactive');

  return {
    total_tables: tables.length,
    active_count: active.length,
    inactive_count: inactive.length,
    tables: tables.map(t => ({
      id: t.id,
      table_number: t.table_number,
      floor: t.floor,
      seats: t.seats,
      status: t.status,
      active_order_id: t.active_order_id || null
    }))
  };
}

async function getKitchenQueue() {
  const orders = await dbAll(
    `SELECT o.*, GROUP_CONCAT(oi.name || ' x' || oi.quantity, ', ') as items_summary
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.status IN ('To Cook', 'Preparing', 'Completed')
     GROUP BY o.id
     ORDER BY o.created_at ASC`
  );

  const byStatus = { 'To Cook': [], Preparing: [], Completed: [] };
  orders.forEach(o => {
    if (byStatus[o.status]) byStatus[o.status].push({
      order_id: o.id,
      table_id: o.table_id,
      items: o.items_summary,
      created_at: o.created_at
    });
  });

  return {
    total_in_queue: orders.length,
    to_cook: byStatus['To Cook'].length,
    preparing: byStatus['Preparing'].length,
    completed_today: byStatus['Completed'].length,
    queue: byStatus
  };
}

async function getLoyaltyStats() {
  const [customerStats, topCustomers, couponUsage] = await Promise.all([
    dbGet(
      `SELECT COUNT(*) as total_customers,
              COALESCE(SUM(loyalty_points),0) as total_points_outstanding,
              COALESCE(AVG(loyalty_points),0) as avg_points
       FROM customers`
    ),
    dbAll(
      `SELECT c.name, c.email, c.loyalty_points,
              COALESCE(SUM(o.total),0) as lifetime_spend,
              COUNT(o.id) as visit_count
       FROM customers c
       LEFT JOIN orders o ON c.id = o.customer_id AND o.payment_status = 'Paid'
       GROUP BY c.id ORDER BY lifetime_spend DESC LIMIT 5`
    ),
    dbAll(
      `SELECT coupon_code, COUNT(*) as times_used, COALESCE(SUM(discount_amount),0) as total_discount_given
       FROM orders
       WHERE coupon_code IS NOT NULL AND payment_status = 'Paid'
       GROUP BY coupon_code ORDER BY times_used DESC`
    )
  ]);

  return {
    total_customers: customerStats.total_customers,
    total_points_outstanding: Math.round(customerStats.total_points_outstanding),
    avg_points_per_customer: parseFloat(customerStats.avg_points.toFixed(1)),
    top_customers: topCustomers,
    coupon_usage: couponUsage
  };
}

async function getKioskLogs({ limit = 10 } = {}) {
  // Kiosk orders are self-service orders (no cashier session, UPI/Digital payment)
  const orders = await dbAll(
    `SELECT o.id, o.total, o.payment_method, o.payment_status, o.status,
            o.created_at, o.table_id,
            GROUP_CONCAT(oi.name || ' x' || oi.quantity, ', ') as items_summary
     FROM orders o
     LEFT JOIN order_items oi ON oi.order_id = o.id
     WHERE o.payment_method IN ('UPI QR', 'Digital/Card')
     GROUP BY o.id
     ORDER BY o.created_at DESC LIMIT ?`,
    [limit]
  );

  const upiTotal = await dbGet(
    `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue
     FROM orders WHERE payment_method = 'UPI QR' AND payment_status = 'Paid'`
  );
  const digitalTotal = await dbGet(
    `SELECT COUNT(*) as count, COALESCE(SUM(total),0) as revenue
     FROM orders WHERE payment_method = 'Digital/Card' AND payment_status = 'Paid'`
  );

  return {
    upi_orders: { count: upiTotal.count, revenue: parseFloat(upiTotal.revenue.toFixed(2)) },
    digital_orders: { count: digitalTotal.count, revenue: parseFloat(digitalTotal.revenue.toFixed(2)) },
    recent_kiosk_orders: orders.map(o => ({
      order_id: o.id,
      total: o.total,
      payment_method: o.payment_method,
      payment_status: o.payment_status,
      status: o.status,
      items: o.items_summary,
      created_at: o.created_at
    }))
  };
}

// ---------------------------------------------------------------------------
// Tool registry  (maps tool name → function)
// ---------------------------------------------------------------------------
const TOOL_FUNCTIONS = {
  getSalesSummary,
  getTableStatus,
  getKitchenQueue,
  getLoyaltyStats,
  getKioskLogs
};

// ---------------------------------------------------------------------------
// Tool definitions  (passed to Granite as JSON schema)
// ---------------------------------------------------------------------------
const TOOL_DEFINITIONS = [
  {
    type: 'function',
    function: {
      name: 'getSalesSummary',
      description: 'Returns sales revenue, order count, top-selling items, and payment breakdown for a given date range.',
      parameters: {
        type: 'object',
        properties: {
          date_range: {
            type: 'string',
            enum: ['today', 'yesterday', 'week', 'month'],
            description: 'The period to summarise. Defaults to today.'
          }
        }
      }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getTableStatus',
      description: 'Returns current occupancy status of all café tables (Active/Inactive) and which tables have live orders.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getKitchenQueue',
      description: 'Returns the current kitchen display queue — orders in To Cook, Preparing, and Completed states.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getLoyaltyStats',
      description: 'Returns customer loyalty stats including top customers by spend, loyalty points outstanding, and coupon usage.',
      parameters: { type: 'object', properties: {} }
    }
  },
  {
    type: 'function',
    function: {
      name: 'getKioskLogs',
      description: 'Returns recent digital/UPI kiosk payment transactions and their statuses.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'integer',
            description: 'Number of recent records to return (default 10)'
          }
        }
      }
    }
  }
];

// ---------------------------------------------------------------------------
// watsonx.ai  helper
// ---------------------------------------------------------------------------
async function callWatsonx(messages, tools) {
  const apiKey = process.env.WATSONX_API_KEY;
  const projectId = process.env.WATSONX_PROJECT_ID;
  const region = process.env.WATSONX_REGION || 'us-south';
  const modelId = process.env.WATSONX_MODEL_ID || 'ibm/granite-3-8b-instruct';
  const watsonxUrl = process.env.WATSONX_URL ||
    `https://${region}.ml.cloud.ibm.com/ml/v1/text/chat?version=2024-05-31`;

  if (!apiKey || !projectId) {
    throw new Error('WATSONX_API_KEY and WATSONX_PROJECT_ID must be set in backend/.env');
  }

  // Get IAM token (15s timeout so error is surfaced clearly)
  const iamController = new AbortController();
  const iamTimer = setTimeout(() => iamController.abort(), 15000);
  let iamRes;
  try {
    iamRes = await fetch('https://iam.cloud.ibm.com/identity/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ibm:params:oauth:grant-type:apikey&apikey=${encodeURIComponent(apiKey)}`,
      signal: iamController.signal
    });
  } catch (fetchErr) {
    clearTimeout(iamTimer);
    if (fetchErr.name === 'AbortError') {
      throw new Error('IBM IAM auth timed out (15s). Check your internet connection — iam.cloud.ibm.com may be unreachable from this network.');
    }
    throw new Error(`IBM IAM auth network error: ${fetchErr.message}. Make sure the backend has internet access.`);
  }
  clearTimeout(iamTimer);
  if (!iamRes.ok) {
    const txt = await iamRes.text();
    throw new Error(`IAM token fetch failed (${iamRes.status}): ${txt}`);
  }
  const { access_token } = await iamRes.json();

  // Call Granite chat endpoint
  const body = {
    model_id: modelId,
    project_id: projectId,
    messages,
    ...(tools && tools.length > 0 ? { tools, tool_choice: 'auto' } : {}),
    max_tokens: 1024,
    temperature: 0.2
  };

  const chatRes = await fetch(watsonxUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${access_token}`
    },
    body: JSON.stringify(body)
  });

  if (!chatRes.ok) {
    const txt = await chatRes.text();
    throw new Error(`watsonx.ai API error ${chatRes.status}: ${txt}`);
  }

  return chatRes.json();
}

// ---------------------------------------------------------------------------
// POST /api/agent/chat
// ---------------------------------------------------------------------------
router.post('/agent/chat', authenticateJWT, authorizeRoles('manager'), async (req, res) => {
  const { message, history = [] } = req.body;

  if (!message || typeof message !== 'string' || message.trim() === '') {
    return res.status(400).json({ error: 'message is required' });
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  const systemPrompt = `You are a café POS data assistant. Today is ${today}.

STRICT RULES — you MUST follow these:
1. NEVER invent, guess, or assume any numbers, names, or data.
2. For ANY question about sales, orders, revenue, tables, kitchen, loyalty points, customers, or payments — you MUST call the relevant tool FIRST.
3. Only use the exact numbers returned by the tool in your answer.
4. If a tool returns revenue=140.40 and order_count=2, say exactly that — do not change the numbers.
5. If the tool returns empty data or zeros, say so honestly — do not fill in fake numbers.
6. Available tools: getSalesSummary, getTableStatus, getKitchenQueue, getLoyaltyStats, getKioskLogs.
7. Use ₹ for all rupee amounts.`;

  // Determine which tool(s) to call directly from the question keywords
  // This avoids relying solely on Granite's tool-selection when it might hallucinate
  const q = message.toLowerCase();
  const forcedTools = [];

  if (q.match(/sale|revenue|order|income|earn|money|today|yesterday|week|month|top.sell|best.sell|item|product/)) {
    const range = q.includes('yesterday') ? 'yesterday' : q.includes('week') ? 'week' : q.includes('month') ? 'month' : 'today';
    forcedTools.push({ name: 'getSalesSummary', args: { date_range: range } });
  }
  if (q.match(/table|floor|seat|occupy|idle|free|available|active/)) {
    forcedTools.push({ name: 'getTableStatus', args: {} });
  }
  if (q.match(/kitchen|cook|queue|prepar|kds|food|order.status/)) {
    forcedTools.push({ name: 'getKitchenQueue', args: {} });
  }
  if (q.match(/loyal|point|customer|coupon|member|reward|crm|visit/)) {
    forcedTools.push({ name: 'getLoyaltyStats', args: {} });
  }
  if (q.match(/upi|digital|kiosk|qr|card|payment|self.service/)) {
    forcedTools.push({ name: 'getKioskLogs', args: {} });
  }

  try {
    let toolResultsText = '';

    if (forcedTools.length > 0) {
      // Run the matched tools directly against the database — no Granite guessing
      const results = await Promise.all(
        forcedTools.map(async ({ name, args }) => {
          try {
            const data = await TOOL_FUNCTIONS[name](args);
            return `[${name} result]: ${JSON.stringify(data)}`;
          } catch (err) {
            return `[${name} error]: ${err.message}`;
          }
        })
      );
      toolResultsText = results.join('\n');
    }

    // Build final message for Granite — give it the real data, ask it to summarise
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-8),
      {
        role: 'user',
        content: forcedTools.length > 0
          ? `Question: ${message.trim()}\n\nLive data from the database:\n${toolResultsText}\n\nUsing ONLY the numbers above, answer the manager's question clearly and concisely.`
          : message.trim()
      }
    ];

    // Call Granite — now it only needs to summarise real data, not decide tool calls
    const response = await callWatsonx(messages, forcedTools.length > 0 ? [] : TOOL_DEFINITIONS);
    let assistantMsg = response.choices?.[0]?.message;

    // If Granite still tries to call tools (for non-keyword questions), execute them
    let iterations = 0;
    while (assistantMsg?.tool_calls?.length > 0 && iterations < 3) {
      iterations++;
      messages.push(assistantMsg);

      const toolResults = await Promise.all(
        assistantMsg.tool_calls.map(async (toolCall) => {
          const fnName = toolCall.function?.name;
          let args = {};
          try { args = JSON.parse(toolCall.function?.arguments || '{}'); } catch (_) {}
          let toolResult;
          try {
            toolResult = TOOL_FUNCTIONS[fnName]
              ? await TOOL_FUNCTIONS[fnName](args)
              : { error: `Unknown tool: ${fnName}` };
          } catch (err) {
            toolResult = { error: err.message };
          }
          return { role: 'tool', tool_call_id: toolCall.id, content: JSON.stringify(toolResult) };
        })
      );

      messages.push(...toolResults);
      const r2 = await callWatsonx(messages, TOOL_DEFINITIONS);
      assistantMsg = r2.choices?.[0]?.message;
    }

    const finalAnswer = assistantMsg?.content || 'I was unable to generate a response. Please try again.';
    return res.json({ answer: finalAnswer });

  } catch (err) {
    console.error('[AgentChat] Error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

export default router;
