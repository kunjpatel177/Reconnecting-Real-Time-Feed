require('dotenv').config();
const http = require('http');
const app = require('./app');
const { connectDB } = require('./config/db');
const { initSocket } = require('./socket/socketHandler');

const PORT = process.env.PORT || 5000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

const server = http.createServer(app);

// Attach Socket.IO to HTTP server
const io = initSocket(server, CLIENT_URL);

// Provide io instance to Express app for controllers/services
app.set('io', io);

async function startServer() {
  try {
    await connectDB();

    server.listen(PORT, () => {
      console.log(`[Server] Incident Feed Service listening on port ${PORT}`);
      console.log(`[Server] Allowed CORS Origin: ${CLIENT_URL}`);
    });
  } catch (error) {
    console.error('[Server] Fatal startup error:', error);
    process.exit(1);
  }
}

// Start if executed directly
if (require.main === module) {
  startServer();
}

module.exports = {
  server,
  app,
  io,
  startServer
};
