import React from 'react';

/**
 * Renders the list of incident updates in strictly ascending sequence order.
 */
function UpdateList({ updates, isLoadingHistory }) {
  const listEndRef = React.useRef(null);

  React.useEffect(() => {
    if (updates.length > 0) {
      listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [updates.length]);

  const formatTime = (dateStr) => {
    if (!dateStr) return '';
    try {
      const d = new Date(dateStr);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="card shadow-sm border-0 bg-white">
      <div className="card-header bg-white border-bottom py-3 d-flex justify-content-between align-items-center">
        <h2 className="h6 fw-bold mb-0 text-secondary text-uppercase">
          Incident Feed Updates
        </h2>
        <span className="badge bg-secondary">
          {updates.length} {updates.length === 1 ? 'event' : 'events'}
        </span>
      </div>

      <div className="card-body p-0 feed-scroll-container">
        {isLoadingHistory ? (
          <div className="p-4 text-center text-muted">
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
            Loading incident history...
          </div>
        ) : updates.length === 0 ? (
          <div className="p-4 text-center text-muted">
            <p className="mb-0">No updates posted yet for this incident.</p>
            <small className="text-secondary">Publish an update above to start the feed.</small>
          </div>
        ) : (
          <div className="list-group list-group-flush">
            {updates.map((update) => (
              <div
                key={update._id}
                className="list-group-item p-3 update-item d-flex flex-column gap-1"
              >
                <div className="d-flex justify-content-between align-items-center">
                  <span className="badge bg-dark sequence-badge">
                    #{update.sequence}
                  </span>
                  <span className="timestamp-text">
                    {formatTime(update.createdAt)}
                  </span>
                </div>
                <div className="text-dark mt-1 text-break" style={{ whiteSpace: 'pre-wrap' }}>
                  {update.message}
                </div>
              </div>
            ))}
            <div ref={listEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}

export default UpdateList;
