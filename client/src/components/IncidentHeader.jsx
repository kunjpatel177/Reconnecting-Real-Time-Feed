import React from 'react';

/**
 * Header displaying application title, active incident ID, and feed context.
 */
function IncidentHeader({ incidentId, lastProcessedSequence }) {
  return (
    <header className="mb-4 pb-3 border-bottom">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
        <div>
          <h1 className="h3 mb-1 fw-bold text-dark">
            <span role="img" aria-label="feed icon" className="me-2">📡</span>
            Incident Feed
          </h1>
          <p className="text-muted mb-0 small">
            Durable incident event stream with real-time delivery and cursor-based recovery.
          </p>
        </div>
        <div className="text-end">
          <div className="badge bg-primary fs-6 px-3 py-2">
            Incident: <strong>{incidentId}</strong>
          </div>
          <div className="text-muted mt-1 small">
            Last Sequence: <span className="fw-semibold text-dark">#{lastProcessedSequence}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default IncidentHeader;
