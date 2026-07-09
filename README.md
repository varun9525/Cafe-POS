# Odoo Cafe POS ☕🏬

A modern, full-stack Cafe Point of Sale (POS) system featuring real-time synchronization, interactive floor plans, a self-service terminal, a kitchen display system (KDS), and an intelligent manager assistant powered by **IBM Granite** on **watsonx.ai** using tool-calling capabilities.

---

## 🌟 Key Features

### 1. 🖥️ Cashier Terminal
*   **Session Management**: Track opening and closing drawer balances to maintain financial accuracy.
*   **Floor & Table Layouts**: View active/inactive tables across floors in real-time. Start orders by clicking tables.
*   **Dynamic Order Builder**: Fast product categorization, item modification, tax calculations, and real-time inventory checks.
*   **Promotions & Coupons**: Apply custom discount codes or leverage automated bulk promotions.
*   **Customer Loyalty Integration**: Search or add customers, and award/redeem loyalty points directly during checkout.
*   **Multi-Mode Payments**: Support for Cash, Digital/Card, and UPI (with a dynamic UPI QR Code display).

### 2. 📊 Admin / Manager Dashboard
*   **Live Sales Analytics**: Visual summaries of revenue, average order value, discount amounts, and popular menu items.
*   **Menu & Inventory Controls**: Full CRUD operations for Products (UOM, price, stock, category, tax) and Categories (with custom CSS colors).
*   **User Management**: Add, update, archive, and manage roles for staff members.
*   **Payment Setup**: Enable or disable payment methods and configure UPI IDs.
*   **Discounts & Campaigns**: Create and manage coupons and automated, criteria-based promotions.
*   **Active Session Auditing**: Real-time monitoring of open cashier sessions, sales volumes, and closing reports.

### 3. 🍳 Kitchen Display System (KDS)
*   **Real-time Order Queue**: Instantly displays new orders placed from cashier terminals or self-service kiosks.
*   **Websocket-driven Status Control**: Move orders seamlessly from `To Cook` ➡️ `Preparing` ➡️ `Completed`.
*   **Color-coded Timers**: Visually track how long orders have been in the queue.

### 4. 📱 Self-Service Kiosk Terminal
*   **Customer-facing Menu**: Beautiful interactive interface displaying categories, prices, images, and descriptions.
*   **Independent Checkout**: Add items, apply customer information, select payment modes (UPI/Digital), and place orders directly.
*   **Automated Queue Sending**: Submits orders directly to the KDS and updates cashier/admin terminals.

### 5. 🤖 IBM Granite AI Chat Agent
An intelligent chatbot widget integrated into the Admin Dashboard. Using Watsonx's Granite model, it utilizes tool-calling to execute live queries against the SQLite database. Managers can ask:
*   *"What are the top-selling products today?"*
*   *"Which tables are currently occupied?"*
*   *"How many orders are waiting in the kitchen?"*
*   *"Show me customer loyalty rankings and coupon usage."*
*   *"What is our total revenue for the last 30 days?"*

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite, React Router v6, Tailwind CSS, Lucide React, Socket.io-client |
| **Backend** | Node.js, Express, Socket.io (WebSockets), JSON Web Tokens (JWT), BcryptJS, express-rate-limit |
| **Database** | SQLite3 (configured with self-healing migrations and indexing) |
| **AI Integration** | IBM Cloud watsonx.ai (using Granite tool-calling models) |

---

## 📂 Project Structure

```text
├── backend/
│   ├── database.js          # SQLite setup, schemas, migrations, and seed data
│   ├── pos.db               # SQLite database file (created on launch)
│   ├── server.js            # Express API, Socket.io event orchestration
│   ├── migrate_db_images.js # Script to map products to local image assets
│   ├── src/
│   │   ├── middleware/      # Authentication & rate-limiting middleware
│   │   └── routes/          # Express route controllers (auth, order, products, agent chat)
│   └── package.json
│
├── frontend/
│   ├── public/              # Static files (images, favicons)
│   ├── src/
│   │   ├── components/      # UI components (AgentChatWidget, TableLayout)
│   │   ├── pages/           # Screen views (Dashboard, Cashier, KDS, Login, SelfService)
│   │   ├── services/        # Axios API clients
│   │   ├── App.jsx          # Route control and user state
│   │   ├── index.css        # Tailwind directives and custom rules
│   │   └── main.jsx
│   ├── tailwind.config.js
│   ├── vite.config.js
│   └── package.json
│
├── package.json             # Root-level configurations and concurrently script
└── README.md
```

---

## 🚀 Setup & Installation

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (v18+ recommended).

### 2. Clone and Install Dependencies
From the root directory, run the following command to automatically install packages for the root, backend, and frontend:
```bash
npm run install-all
```

### 3. Configure Environment Variables
Create a `.env` file in the `backend` directory. You can duplicate `backend/.env.example` as a starting point:
```bash
cp backend/.env.example backend/.env
```

Define the configuration variables inside `backend/.env`:
*   `JWT_SECRET`: Secret key used to sign JSON Web Tokens.
*   `DB_PATH`: SQLite database filename (defaults to `pos.db`).
*   `PORT`: Port for the backend server (defaults to `3001`).
*   `WATSONX_API_KEY`: Your IBM Cloud API key.
*   `WATSONX_PROJECT_ID`: Your watsonx.ai project ID.
*   `WATSONX_REGION`: Cloud region hosting your instance (e.g., `us-south`, `eu-de`).
*   `WATSONX_MODEL_ID`: IBM Granite model identifier (e.g., `ibm/granite-3-8b-instruct`).

### 4. Run the Application
Start the backend and frontend dev servers concurrently using the root package script:
```bash
npm run dev
```

*   **Backend Server**: Launches on [http://localhost:3001](http://localhost:3001)
*   **Vite Frontend**: Launches on [http://localhost:5173](http://localhost:5173)

---

## 🔐 Credentials & Roles for Testing

The system is seeded automatically on initial run. Use the credentials below to test each user role:

| Name | Username | Password | Default Role | Authorized Sections |
| :--- | :--- | :--- | :--- | :--- |
| **Admin Manager** | `admin` | `admin123` | `manager` | Admin Dashboard, Cashier Terminal, KDS, AI Assistant |
| **Cashier Staff** | `cashier` | `cashier123` | `cashier` | Cashier Terminal |
| **Kitchen Cook** | `cook` | `cook123` | `cook` | Kitchen Display System (KDS) |
| **Customer User** | `customer` | `customer123` | `customer` | Self-Service Kiosk |