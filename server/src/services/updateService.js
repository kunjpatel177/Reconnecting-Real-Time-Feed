const IncidentUpdate = require('../models/IncidentUpdate');
const { getNextSequence } = require('./sequenceService');

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

/**
 * Creates, persists, and broadcasts a new incident update.
 *
 * CORE ARCHITECTURAL PRINCIPLE:
 * MongoDB is the durable source of truth. Persistence MUST happen before broadcast.
 * If persistence fails, the update is never broadcast.
 *
 * @param {Object} params
 * @param {string} params.incidentId
 * @param {string} params.message
 * @param {import('socket.io').Server} [params.io] Socket.IO instance for transient broadcast
 * @returns {Promise<Object>} The persisted update document
 */
async function createUpdate({ incidentId, message, io }) {
  if (!incidentId || typeof incidentId !== 'string' || !incidentId.trim()) {
    const err = new Error('incidentId is required and must be a non-empty string');
    err.statusCode = 400;
    throw err;
  }

  if (!message || typeof message !== 'string' || !message.trim()) {
    const err = new Error('message is required and must be a non-empty string');
    err.statusCode = 400;
    throw err;
  }

  const trimmedMessage = message.trim();
  if (trimmedMessage.length > 500) {
    const err = new Error('message cannot exceed 500 characters');
    err.statusCode = 400;
    throw err;
  }

  const trimmedIncidentId = incidentId.trim();

  // 1. Atomically allocate next sequence number
  const sequence = await getNextSequence(trimmedIncidentId);

  // 2. Persist update in MongoDB (Durable source of truth)
  const persistedUpdate = await IncidentUpdate.create({
    incidentId: trimmedIncidentId,
    sequence,
    message: trimmedMessage
  });

  const updateObject = {
    _id: persistedUpdate._id.toString(),
    incidentId: persistedUpdate.incidentId,
    sequence: persistedUpdate.sequence,
    message: persistedUpdate.message,
    createdAt: persistedUpdate.createdAt
  };

  // 3. Transient real-time delivery via Socket.IO only AFTER successful DB confirmation
  if (io) {
    io.to(`incident:${trimmedIncidentId}`).emit('incident:update', updateObject);
  }

  return updateObject;
}

/**
 * Retrieves bounded updates for a specific incident using cursor pagination.
 *
 * @param {Object} params
 * @param {string} params.incidentId
 * @param {number|string} [params.after] Cursor: fetch updates with sequence > after
 * @param {number|string} [params.limit] Max number of updates to return (bounded 1-100)
 * @returns {Promise<{ updates: Array, nextCursor: number|null, hasMore: boolean }>}
 */
async function getUpdates({ incidentId, after, limit }) {
  if (!incidentId || typeof incidentId !== 'string' || !incidentId.trim()) {
    const err = new Error('incidentId is required and must be a non-empty string');
    err.statusCode = 400;
    throw err;
  }

  const trimmedIncidentId = incidentId.trim();

  // Validate and parse limit (bounded between 1 and MAX_LIMIT)
  let parsedLimit = DEFAULT_LIMIT;
  if (limit !== undefined && limit !== null && limit !== '') {
    const numLimit = Number(limit);
    if (!Number.isInteger(numLimit) || numLimit <= 0) {
      const err = new Error('limit must be a positive integer');
      err.statusCode = 400;
      throw err;
    }
    parsedLimit = Math.min(numLimit, MAX_LIMIT);
  }

  // Build query
  const query = { incidentId: trimmedIncidentId };

  // Validate and apply 'after' cursor
  if (after !== undefined && after !== null && after !== '') {
    const numAfter = Number(after);
    if (isNaN(numAfter) || numAfter < 0 || !Number.isInteger(numAfter)) {
      const err = new Error('after cursor must be a non-negative integer');
      err.statusCode = 400;
      throw err;
    }
    query.sequence = { $gt: numAfter };
  }

  // Fetch limit + 1 records to accurately determine hasMore
  const docs = await IncidentUpdate.find(query)
    .sort({ sequence: 1 })
    .limit(parsedLimit + 1)
    .lean();

  const hasMore = docs.length > parsedLimit;
  const updates = hasMore ? docs.slice(0, parsedLimit) : docs;

  // Format updates
  const formattedUpdates = updates.map((doc) => ({
    _id: doc._id.toString(),
    incidentId: doc.incidentId,
    sequence: doc.sequence,
    message: doc.message,
    createdAt: doc.createdAt
  }));

  const nextCursor =
    formattedUpdates.length > 0
      ? formattedUpdates[formattedUpdates.length - 1].sequence
      : (after !== undefined && after !== null && after !== '' ? Number(after) : null);

  return {
    updates: formattedUpdates,
    nextCursor,
    hasMore
  };
}

module.exports = {
  createUpdate,
  getUpdates,
  DEFAULT_LIMIT,
  MAX_LIMIT
};
