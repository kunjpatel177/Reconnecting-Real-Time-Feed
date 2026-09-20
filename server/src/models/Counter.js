const mongoose = require('mongoose');

/**
 * Counter schema for per-incident atomic monotonic sequence allocation.
 * _id represents the incidentId (e.g., 'incident-1').
 */
const counterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true
    },
    sequence: {
      type: Number,
      default: 0
    }
  },
  {
    versionKey: false
  }
);

const Counter = mongoose.model('Counter', counterSchema);

module.exports = Counter;
