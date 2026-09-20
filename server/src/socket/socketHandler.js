const { Server } = require('socket.io');

/**
 * Initializes and configures Socket.IO server.
 *
 * @param {import('http').Server} httpServer Node HTTP server
 * @param {string} [clientUrl] Allowed frontend origin for CORS
 * @returns {import('socket.io').Server}
 */
function initSocket(httpServer, clientUrl) {
  const allowedOrigin = clientUrl || process.env.CLIENT_URL || 'http://localhost:5173';

  const io = new Server(httpServer, {
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin or localhost/127.0.0.1
        if (!origin || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
          return callback(null, true);
        }
        return callback(null, true);
      },
      methods: ['GET', 'POST'],
      credentials: true
    }
  });

  io.on('connection', (socket) => {
    console.log(`[Socket.IO] Client connected: ${socket.id}`);

    /**
     * Client requests to join a specific incident feed room.
     * Enforces room isolation: 'incident:<incidentId>'
     */
    socket.on('incident:join', (data, callback) => {
      const incidentId = data && typeof data.incidentId === 'string' ? data.incidentId.trim() : null;

      if (!incidentId) {
        console.warn(`[Socket.IO] Socket ${socket.id} attempted to join with invalid incidentId`);
        if (typeof callback === 'function') {
          callback({ success: false, error: 'Invalid incidentId' });
        }
        return;
      }

      const roomName = `incident:${incidentId}`;
      socket.join(roomName);
      console.log(`[Socket.IO] Socket ${socket.id} joined room ${roomName}`);

      if (typeof callback === 'function') {
        callback({ success: true, room: roomName });
      }
    });

    socket.on('disconnect', (reason) => {
      console.log(`[Socket.IO] Client disconnected: ${socket.id}, reason: ${reason}`);
    });

    socket.on('error', (err) => {
      console.error(`[Socket.IO] Socket ${socket.id} error:`, err);
    });
  });

  return io;
}

module.exports = {
  initSocket
};
