import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import db from './database.js';

// Route Imports
import authRoutes from './src/routes/authRoutes.js';
import productRoutes from './src/routes/productRoutes.js';
import sessionRoutes from './src/routes/sessionRoutes.js';
import orderRoutes from './src/routes/orderRoutes.js';
import miscRoutes from './src/routes/miscRoutes.js';
import agentChatRoutes from './src/routes/agentChat.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE']
  }
});

const JWT_SECRET = process.env.JWT_SECRET || 'odoo_cafe_pos_super_secret_key';

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/images', express.static(path.join(__dirname, '../frontend/public/images')));

// Socket.io Connection & State Management
const activeSockets = new Map();

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
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

// Mounting Router Layer with Dependency Injection
app.use('/api/auth', authRoutes);
app.use('/api', productRoutes);
app.use('/api', sessionRoutes(io));
app.use('/api', orderRoutes(io));
app.use('/api', miscRoutes(io, activeSockets));
app.use('/api', agentChatRoutes);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Backend server active on http://localhost:${PORT}`);
});
export { io, activeSockets };
