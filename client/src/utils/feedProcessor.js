/**
 * Centralized Feed Processor for Client-Side Update Management.
 *
 * All incoming updates from any source (initial history, recovery replay, live socket broadcast)
 * pass through this centralized function to enforce:
 * 1. Deduplication using stable document _id
 * 2. Deterministic ascending sort by server-assigned sequence number
 * 3. Atomic progression of lastProcessedSequence
 *
 * @param {Array} currentUpdates Current updates array in React state
 * @param {Array|Object} incoming Incoming update or array of updates
 * @param {Set<string>} seenIds Set of already processed _id strings
 * @returns {{ updates: Array, lastProcessedSequence: number, hasChanged: boolean }}
 */
export function processIncomingUpdates(currentUpdates = [], incoming, seenIds = null) {
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

  // Derive seen set purely from currentUpdates so that state updates are 100% idempotent in React StrictMode
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
