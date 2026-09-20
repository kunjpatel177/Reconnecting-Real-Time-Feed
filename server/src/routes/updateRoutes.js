const express = require('express');
const router = express.Router();
const updateController = require('../controllers/updateController');

// System health check
router.get('/health', updateController.getHealth);

// Incident updates (cursor-based pagination & recovery)
router.get('/incidents/:incidentId/updates', updateController.getUpdates);

// Publish a new update to an incident feed
router.post('/incidents/:incidentId/updates', updateController.createUpdate);

module.exports = router;
