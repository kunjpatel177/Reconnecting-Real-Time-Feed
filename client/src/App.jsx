import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createSocketClient } from './services/socket';
import { fetchUpdates, publishUpdate } from './services/api';
import { processIncomingUpdates } from './utils/feedProcessor';
import IncidentHeader from './components/IncidentHeader';
import ConnectionStatus from './components/ConnectionStatus';
import MessageInput from './components/MessageInput';
import UpdateList from './components/UpdateList';

const INCIDENT_ID = 'incident-1';

function App() {
  const [updates, setUpdates] = useState([]);
  const [connectionState, setConnectionState] = useState('Connecting');
  const [isRecovering, setIsRecovering] = useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);
  const [globalError, setGlobalError] = useState(null);

  // Ref tracking latest sequence number across asynchronous callbacks
  const lastSeqRef = useRef(0);

  // Durable deduplication set surviving React renders
  const seenUpdatesRef = useRef(new Set());

  // Flag to distinguish initial connection from subsequent reconnections
  const hasLoadedInitialRef = useRef(false);

  // Active Socket.IO reference
  const socketRef = useRef(null);

  // Derive lastProcessedSequence directly from updates array to maintain 100% synchronization
  const lastProcessedSequence = updates.length > 0 ? updates[updates.length - 1].sequence : 0;

  // Synchronize refs with committed state
  useEffect(() => {
    seenUpdatesRef.current = new Set(updates.map((u) => String(u._id)));
    if (updates.length > 0) {
      lastSeqRef.current = updates[updates.length - 1].sequence;
    }
  }, [updates]);

  /**
   * Centralized Update Processor
   * All incoming data (history, live events, recovery replays) flows through here.
   * Uses pure functional state updater compatible with React 18 Concurrent/Strict mode.
   */
  const handleIncomingUpdates = useCallback((incoming) => {
    setUpdates((prevUpdates) => {
      const result = processIncomingUpdates(prevUpdates, incoming);
      return result.hasChanged ? result.updates : prevUpdates;
    });
  }, []);

  /**
   * Missed-Update Recovery Flow
   * Called automatically whenever Socket.IO reconnects.
   * Recovers events starting strictly after lastProcessedSequence.
   */
  const recoverMissedUpdates = useCallback(async () => {
    const cursor = lastSeqRef.current;
    console.log(`[Recovery] Initiating recovery for ${INCIDENT_ID} after sequence #${cursor}`);
    setIsRecovering(true);
    setGlobalError(null);

    try {
      let currentCursor = cursor;
      let hasMoreUpdates = true;

      // Drain all missing updates in bounded pages if needed
      while (hasMoreUpdates) {
        const response = await fetchUpdates(INCIDENT_ID, currentCursor, 50);
        const fetched = response.updates || [];

        if (fetched.length > 0) {
          handleIncomingUpdates(fetched);
          currentCursor = response.nextCursor || fetched[fetched.length - 1].sequence;
        }

        hasMoreUpdates = response.hasMore;
      }
      console.log(`[Recovery] Recovery complete. Last sequence: #${lastSeqRef.current}`);
    } catch (err) {
      console.error('[Recovery] Recovery failed:', err);
      setGlobalError('Failed to recover missed updates. Please check network connection.');
    } finally {
      setIsRecovering(false);
    }
  }, [handleIncomingUpdates]);

  /**
   * Initial History Fetch
   */
  const loadInitialHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    setGlobalError(null);

    try {
      console.log(`[InitialLoad] Fetching initial history for ${INCIDENT_ID}`);
      const data = await fetchUpdates(INCIDENT_ID, null, 50);
      handleIncomingUpdates(data.updates || []);
    } catch (err) {
      console.error('[InitialLoad] Error fetching history:', err);
      setGlobalError('Unable to load incident history from server.');
    } finally {
      setIsLoadingHistory(false);
      hasLoadedInitialRef.current = true;
    }
  }, [handleIncomingUpdates]);

  /**
   * Socket.IO Lifecycle Management & Reconnection Handling
   */
  useEffect(() => {
    const socket = createSocketClient();
    socketRef.current = socket;

    const joinIncidentRoom = () => {
      console.log(`[Socket.IO] Joining room incident:${INCIDENT_ID}`);
      socket.emit('incident:join', { incidentId: INCIDENT_ID }, (ack) => {
        if (!ack?.success) {
          console.error('[Socket.IO] Failed to join room:', ack?.error);
        } else {
          console.log('[Socket.IO] Room joined successfully:', ack?.room);
        }
      });
    };

    // Connect event
    socket.on('connect', () => {
      console.log(`[Socket.IO] Connected. Socket ID: ${socket.id}`);
      setConnectionState('Connected');
      setReconnectAttempts(0);
      setGlobalError(null);

      // Join room
      joinIncidentRoom();

      // If initial history was already fetched, this is a RECONNECTION -> recover missed updates
      if (hasLoadedInitialRef.current) {
        recoverMissedUpdates();
      }
    });

    // If socket connected immediately before event listener was registered
    if (socket.connected) {
      setConnectionState('Connected');
      joinIncidentRoom();
    }

    // Disconnect event
    socket.on('disconnect', (reason) => {
      console.warn(`[Socket.IO] Disconnected. Reason: ${reason}`);
      setConnectionState('Disconnected');
    });

    // Reconnecting events
    socket.io.on('reconnect_attempt', (attempt) => {
      console.log(`[Socket.IO] Reconnecting attempt #${attempt}`);
      setConnectionState('Reconnecting');
      setReconnectAttempts(attempt);
    });

    socket.io.on('reconnect_failed', () => {
      console.error('[Socket.IO] Reconnect failed after maximum attempts.');
      setConnectionState('Disconnected');
      setGlobalError('Reconnection attempts exhausted. Please manually reconnect.');
    });

    socket.on('connect_error', (error) => {
      console.warn('[Socket.IO] Connection error:', error.message);
      if (socket.connected) {
        setConnectionState('Connected');
      } else {
        setConnectionState(socket.active ? 'Reconnecting' : 'Disconnected');
      }
    });

    // Real-time broadcast listener
    socket.on('incident:update', (update) => {
      console.log('[Socket.IO] Received live broadcast update:', update);
      handleIncomingUpdates(update);
    });

    // Fetch initial history
    loadInitialHistory();

    return () => {
      socket.disconnect();
    };
  }, [handleIncomingUpdates, recoverMissedUpdates, loadInitialHistory]);

  /**
   * Publish Update Handler
   */
  const handleSendMessage = async (message) => {
    setIsSubmitting(true);
    setGlobalError(null);

    try {
      // POST to backend. Backend persists to MongoDB FIRST, then broadcasts via Socket.IO.
      const persistedUpdate = await publishUpdate(INCIDENT_ID, message);
      // Pass persisted response through centralized processor for deterministic deduplication
      handleIncomingUpdates(persistedUpdate);
    } catch (err) {
      console.error('[Publish] Failed to publish update:', err);
      const msg = err.response?.data?.error || err.message || 'Failed to publish update.';
      setGlobalError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Real Network Toggle for Interviewer Demonstration
   */
  const handleToggleConnection = () => {
    if (!socketRef.current) return;

    if (socketRef.current.connected) {
      console.log('[Demo] Disconnecting socket manually...');
      socketRef.current.disconnect();
    } else {
      console.log('[Demo] Reconnecting socket manually...');
      socketRef.current.connect();
    }
  };

  return (
    <div className="container py-4 feed-container">
      <IncidentHeader
        incidentId={INCIDENT_ID}
        lastProcessedSequence={lastProcessedSequence}
      />

      <ConnectionStatus
        connectionState={connectionState}
        isRecovering={isRecovering}
        reconnectAttempts={reconnectAttempts}
        onToggleConnection={handleToggleConnection}
      />

      {globalError && (
        <div className="alert alert-warning alert-dismissible fade show mb-4 shadow-sm" role="alert">
          <strong>Notice:</strong> {globalError}
          <button
            type="button"
            className="btn-close"
            aria-label="Close"
            onClick={() => setGlobalError(null)}
          />
        </div>
      )}

      <MessageInput
        onSendMessage={handleSendMessage}
        isSubmitting={isSubmitting}
        connectionState={connectionState}
      />

      <UpdateList
        updates={updates}
        isLoadingHistory={isLoadingHistory}
      />
    </div>
  );
}

export default App;
