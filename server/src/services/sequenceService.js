const Counter = require('../models/Counter');

/**
 * Atomically allocates the next monotonically increasing sequence number for an incident.
 * Uses MongoDB findOneAndUpdate with $inc and upsert: true.
 *
 * @param {string} incidentId The target incident identifier
 * @returns {Promise<number>} The newly allocated sequence number
 */
async function getNextSequence(incidentId) {
  if (!incidentId || typeof incidentId !== 'string' || !incidentId.trim()) {
    throw new Error('Valid incidentId is required for sequence allocation');
  }

  const trimmedIncidentId = incidentId.trim();

  // Atomically increment the sequence counter for this incident.
  // If the counter does not exist yet, upsert creates it with sequence: 1.
  const counter = await Counter.findOneAndUpdate(
    { _id: trimmedIncidentId },
    { $inc: { sequence: 1 } },
    {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true
    }
  );

  return counter.sequence;
}

module.exports = {
  getNextSequence
};
