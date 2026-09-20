import React, { useState } from 'react';

/**
 * Message input form for publishing updates to the incident feed.
 */
function MessageInput({ onSendMessage, isSubmitting, connectionState }) {
  const [message, setMessage] = useState('');
  const [localError, setLocalError] = useState('');

  const MAX_LENGTH = 500;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    const trimmed = message.trim();
    if (!trimmed) {
      setLocalError('Message cannot be empty.');
      return;
    }

    if (trimmed.length > MAX_LENGTH) {
      setLocalError(`Message cannot exceed ${MAX_LENGTH} characters.`);
      return;
    }

    try {
      await onSendMessage(trimmed);
      setMessage('');
    } catch (err) {
      setLocalError(err.response?.data?.error || err.message || 'Failed to publish update.');
    }
  };

  return (
    <div className="card shadow-sm border-0 bg-white mb-4">
      <div className="card-body p-3">
        <h2 className="h6 fw-bold mb-3 text-secondary text-uppercase">Publish Incident Update</h2>

        {localError && (
          <div className="alert alert-danger alert-dismissible py-2 px-3 small" role="alert">
            {localError}
            <button
              type="button"
              className="btn-close btn-close-sm"
              aria-label="Close"
              onClick={() => setLocalError('')}
            />
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-2">
            <textarea
              className="form-control"
              rows="3"
              placeholder="Enter incident update details (e.g., Investigating latency spike, Applied patch)..."
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                if (localError) setLocalError('');
              }}
              maxLength={MAX_LENGTH}
              disabled={isSubmitting}
            />
          </div>

          <div className="d-flex justify-content-between align-items-center">
            <span className={`small ${message.length > MAX_LENGTH - 50 ? 'text-danger' : 'text-muted'}`}>
              {message.length} / {MAX_LENGTH} characters
            </span>

            <button
              type="submit"
              className="btn btn-primary px-4 fw-semibold d-inline-flex align-items-center gap-2"
              disabled={isSubmitting || !message.trim()}
            >
              {isSubmitting ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
                  <span>Publishing...</span>
                </>
              ) : (
                <>
                  <span>Send Update</span>
                  <span>→</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default MessageInput;
