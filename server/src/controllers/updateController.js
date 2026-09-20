const mongoose = require('mongoose');
const updateService = require('../services/updateService');

/**
 * Health check endpoint.
 */
async function getHealth(req, res) {
  const isDbConnected = mongoose.connection.readyState === 1;
  return res.status(isDbConnected ? 200 : 503).json({
    status: isDbConnected ? 'ok' : 'degraded',
    database: isDbConnected ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
}

/**
 * GET /api/incidents/:incidentId/updates
 * Supports cursor-based recovery (?after=<sequence>&limit=<number>).
 */
async function getUpdates(req, res, next) {
  try {
    const { incidentId } = req.params;
    const { after, limit } = req.query;

    const result = await updateService.getUpdates({
      incidentId,
      after,
      limit
    });

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/incidents/:incidentId/updates
 * Body: { "message": "..." }
 * Persistence occurs BEFORE Socket.IO broadcast.
 */
async function createUpdate(req, res, next) {
  try {
    const { incidentId } = req.params;
    const { message } = req.body;

    if (!req.body || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Request body must contain a "message" string field'
      });
    }

    const io = req.app.get('io');

    const update = await updateService.createUpdate({
      incidentId,
      message,
      io
    });

    return res.status(201).json(update);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getHealth,
  getUpdates,
  createUpdate
};
