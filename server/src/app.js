const express = require('express');
const cors = require('cors');
const updateRoutes = require('./routes/updateRoutes');

const app = express();

// Allowed frontend client origin
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

// Dynamic CORS configuration allowing localhost or 127.0.0.1 on any port in local dev
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl) or localhost/127.0.0.1
      if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
        return callback(null, true);
      }
      return callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'OPTIONS']
  })
);

// JSON body parsing
app.use(express.json());

// API Routes mounted under /api
app.use('/api', updateRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ error: `Not Found: ${req.method} ${req.originalUrl}` });
});

// Centralized error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const message = err.message || 'Internal Server Error';

  if (statusCode >= 500) {
    console.error('[ServerError]', err);
  }

  res.status(statusCode).json({
    error: message
  });
});

module.exports = app;
