import React from 'react';

/**
 * Component rendering visible connection state, recovery indicators,
 * and a real network toggle to facilitate interviewer/reviewer testing.
 */
function ConnectionStatus({
  connectionState,
  isRecovering,
  reconnectAttempts = 0,
  onToggleConnection
}) {
  // Map connection state to appropriate Bootstrap badge and status dot
  const getBadgeDetails = () => {
    switch (connectionState) {
      case 'Connected':
        return {
          badgeClass: 'bg-success',
          dotClass: 'status-connected',
          label: 'Connected'
        };
      case 'Connecting':
        return {
          badgeClass: 'bg-warning text-dark',
          dotClass: 'status-connecting',
          label: 'Connecting...'
        };
      case 'Reconnecting':
        return {
          badgeClass: 'bg-warning text-dark',
          dotClass: 'status-reconnecting',
          label: `Reconnecting (attempt ${reconnectAttempts})...`
        };
      case 'Disconnected':
      default:
        return {
          badgeClass: 'bg-danger',
          dotClass: 'status-disconnected',
          label: 'Disconnected'
        };
    }
  };

  const { badgeClass, dotClass, label } = getBadgeDetails();

  return (
    <div className="card shadow-sm mb-4 border-0 bg-white">
      <div className="card-body p-3 d-flex flex-wrap justify-content-between align-items-center gap-3">
        <div className="d-flex align-items-center gap-2">
          <span className="fw-semibold text-secondary small text-uppercase">Status:</span>
          <span className={`badge ${badgeClass} d-inline-flex align-items-center px-2 py-1`}>
            <span className={`status-dot ${dotClass}`} />
            {label}
          </span>

          {/* Recovery in progress indicator */}
          {isRecovering && (
            <span className="badge bg-info text-dark d-inline-flex align-items-center gap-1 ms-2 animate-pulse">
              <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
              <span>Recovering missed updates...</span>
            </span>
          )}
        </div>

        {/* Real Socket.IO Disconnect / Reconnect button for reviewer demonstration */}
        <div>
          <button
            type="button"
            className={`btn btn-sm ${
              connectionState === 'Connected' ? 'btn-outline-danger' : 'btn-outline-success'
            }`}
            onClick={onToggleConnection}
            title={
              connectionState === 'Connected'
                ? 'Disconnect Socket.IO to test offline publishing & recovery'
                : 'Reconnect Socket.IO to test cursor-based missed-update recovery'
            }
          >
            {connectionState === 'Connected' ? 'Simulate Disconnect' : 'Reconnect Socket'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ConnectionStatus;
