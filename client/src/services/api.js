import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * Fetch updates for an incident with optional cursor (?after=) and limit (?limit=).
 * @param {string} incidentId
 * @param {number|null} [after]
 * @param {number|null} [limit]
 * @returns {Promise<{ updates: Array, nextCursor: number|null, hasMore: boolean }>}
 */
export async function fetchUpdates(incidentId, after = null, limit = null) {
  const params = {};
  if (after !== null && after !== undefined) {
    params.after = after;
  }
  if (limit !== null && limit !== undefined) {
    params.limit = limit;
  }

  const response = await apiClient.get(`/incidents/${encodeURIComponent(incidentId)}/updates`, {
    params
  });
  return response.data;
}

/**
 * Publish a new update to the incident feed via HTTP POST.
 * Persistence occurs before Socket.IO broadcast on the backend.
 * @param {string} incidentId
 * @param {string} message
 * @returns {Promise<Object>} Persisted update
 */
export async function publishUpdate(incidentId, message) {
  const response = await apiClient.post(`/incidents/${encodeURIComponent(incidentId)}/updates`, {
    message
  });
  return response.data;
}

/**
 * Check backend health status.
 * @returns {Promise<Object>}
 */
export async function fetchHealth() {
  const response = await apiClient.get('/health');
  return response.data;
}

export default apiClient;
