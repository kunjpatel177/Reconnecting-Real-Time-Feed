/**
 * Centralized Feed Processor for Client-Side Update Management.
 *
 * Responsibilities:
 * 1. Validates that every update has a stable identifier (_id).
 * 2. Checks whether update._id already exists in the deduplication Set.
 * 3. Discards duplicates cleanly without altering state.
 * 4. Adds unique updates and sorts all updates by sequence ascending.
 * 5. Computes the highest processed sequence number (lastProcessedSequence).
 *
 * @param {Array} currentUpdates Current array of updates in state
 * @param {Array|Object} incoming Incoming update or array of updates (from history, live socket, or recovery)
 * @param {Set<string>} seenIds Set tracking unique _id strings
 * @returns {{ updates: Array, lastProcessedSequence: number, hasChanged: boolean }}
 */
function processIncomingUpdates(currentUpdates = [], incoming, seenIds = null) {
  if (!incoming) {
    const maxSeq = currentUpdates.reduce((max, u) => Math.max(max, u.sequence || 0), 0);
    return {
      updates: currentUpdates,
      lastProcessedSequence: maxSeq,
      hasChanged: false
    };
  }

  const items = Array.isArray(incoming) ? incoming : [incoming];
  let hasChanged = false;
  const nextList = [...currentUpdates];

  // Derive seen set purely from currentUpdates so that state updates are 100% idempotent
  const existingSet = new Set(currentUpdates.map((u) => String(u._id)));

  for (const item of items) {
    if (!item || !item._id) {
      continue;
    }

    const idStr = String(item._id);

    // If already in current state (or in external seenIds if provided)
    if (existingSet.has(idStr) || (seenIds && seenIds.has(idStr))) {
      continue;
    }

    existingSet.add(idStr);
    if (seenIds) {
      seenIds.add(idStr);
    }
    nextList.push(item);
    hasChanged = true;
  }

  if (!hasChanged) {
    const maxSeq = currentUpdates.reduce((max, u) => Math.max(max, u.sequence || 0), 0);
    return {
      updates: currentUpdates,
      lastProcessedSequence: maxSeq,
      hasChanged: false
    };
  }

  // Stable ordering: strictly ascending by server-assigned sequence number
  nextList.sort((a, b) => (Number(a.sequence) || 0) - (Number(b.sequence) || 0));

  // Determine highest processed sequence
  const highestSeq = nextList.reduce((max, u) => Math.max(max, Number(u.sequence) || 0), 0);

  return {
    updates: nextList,
    lastProcessedSequence: highestSeq,
    hasChanged: true
  };
}

module.exports = {
  processIncomingUpdates
};
