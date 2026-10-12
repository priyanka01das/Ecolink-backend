import dns from 'node:dns';

dns.setServers(['8.8.8.8', '1.1.1.1']);
import express from 'express';
import http from 'http';
import cors from 'cors';
import dotenv from 'dotenv';
import morgan from 'morgan';

import { connectDB } from './config/db.js';
import { initSocket } from './config/socket.js';

import authRoutes from './routes/authRoutes.js';
import listingRoutes from './routes/listingRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Enable CORS
const allowedOrigins = process.env.CLIENT_ORIGIN 
  ? process.env.CLIENT_ORIGIN.split(',').map(o => o.trim())
  : ['http://localhost:5173', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
  app.use(morgan('dev'));
}

// Initialize Socket.IO with server
initSocket(server, corsOptions);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    appName: 'EcoLink - B2B Biodegradable Waste Management & Bio-Energy Marketplace API',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// 404 Route handler
app.use((req, res, next) => {
  res.status(404).json({ message: `Route not found - ${req.originalUrl}` });
});

// Global Error Handler Middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Error:', err.stack);
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode).json({
    message: err.message || 'Internal Server Error',
    stack: process.env.NODE_ENV === 'production' ? null : err.stack
  });
});

const PORT = process.env.PORT || 5000;

// Friendly port collision handler
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n❌ Error: Port ${PORT} is already in use by another running process.`);
    console.error(`👉 To free up port ${PORT}, run this command in PowerShell:`);
    console.error(`   Get-NetTCPConnection -LocalPort ${PORT} | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }\n`);
    process.exit(1);
  } else {
    console.error('Server error:', err);
  }
});

// Start listening immediately
server.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 EcoLink Server running on http://localhost:${PORT}`);
  console.log(`🌿 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`====================================================`);
  
  // Connect database asynchronously
  connectDB().catch(err => {
    console.warn('DB init warning:', err.message);
  });
});
