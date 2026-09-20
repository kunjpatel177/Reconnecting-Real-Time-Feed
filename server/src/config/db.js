const mongoose = require('mongoose');

/**
 * Connect to MongoDB using Mongoose.
 * @param {string} [uri] Optional URI override (useful for tests)
 * @returns {Promise<typeof mongoose>}
 */
async function connectDB(uri) {
  const mongoUri = uri || process.env.MONGO_URI || 'mongodb://localhost:27017/incident_feed';
  try {
    const conn = await mongoose.connect(mongoUri);
    console.log(`[MongoDB] Connected: ${conn.connection.host || 'in-memory'}`);
    return conn;
  } catch (error) {
    console.error(`[MongoDB] Connection error: ${error.message}`);
    throw error;
  }
}

/**
 * Disconnect from MongoDB.
 * @returns {Promise<void>}
 */
async function disconnectDB() {
  try {
    await mongoose.disconnect();
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error(`[MongoDB] Disconnection error: ${error.message}`);
    throw error;
  }
}

module.exports = {
  connectDB,
  disconnectDB
};
