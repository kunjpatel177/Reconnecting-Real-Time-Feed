const mongoose = require('mongoose');

/**
 * IncidentUpdate schema representing durable incident event history.
 * MongoDB is the durable source of truth.
 */
const incidentUpdateSchema = new mongoose.Schema(
  {
    incidentId: {
      type: String,
      required: [true, 'incidentId is required'],
      trim: true,
      index: true
    },
    sequence: {
      type: Number,
      required: [true, 'sequence is required'],
      index: true
    },
    message: {
      type: String,
      required: [true, 'message is required'],
      trim: true,
      maxlength: [500, 'message cannot exceed 500 characters']
    },
    createdAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    versionKey: false
  }
);

// Enforce that sequence numbers are strictly unique per incident
incidentUpdateSchema.index({ incidentId: 1, sequence: 1 }, { unique: true });

const IncidentUpdate = mongoose.model('IncidentUpdate', incidentUpdateSchema);

module.exports = IncidentUpdate;
