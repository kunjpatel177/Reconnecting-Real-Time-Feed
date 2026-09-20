import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5000';

/**
 * Initializes and returns a Socket.IO client instance with bounded reconnection backoff.
 *
 * Reconnection Strategy:
 * - reconnection: true
 * - reconnectionAttempts: 8 (bounded attempts to prevent infinite tight loops)
 * - reconnectionDelay: 1000ms initial backoff
 * - reconnectionDelayMax: 5000ms max exponential backoff
 */
export function createSocketClient() {
  return io(SOCKET_URL, {
    transports: ['websocket', 'polling'],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000
  });
}
