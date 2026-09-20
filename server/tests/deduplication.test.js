const { processIncomingUpdates } = require('../src/utils/feedProcessor');

describe('TEST 3: Multi-Path Deduplication', () => {
  it('displays the same logical update only once when received from history, live socket, and recovery', () => {
    const seenIds = new Set();
    let updates = [];

    // The identical logical update with stable identifier
    const update4 = {
      _id: '65f1234567890abcdef00004',
      incidentId: 'incident-1',
      sequence: 4,
      message: 'Database connection restored',
      createdAt: '2026-09-18T10:30:00.000Z'
    };

    // 1. Arrival via Initial History
    const historyResult = processIncomingUpdates(updates, update4, seenIds);
    updates = historyResult.updates;

    expect(updates).toHaveLength(1);
    expect(updates[0]._id).toBe(update4._id);
    expect(historyResult.lastProcessedSequence).toBe(4);
    expect(seenIds.has(update4._id)).toBe(true);

    // 2. Arrival via Live Socket.IO broadcast (duplicate arrival)
    const socketResult = processIncomingUpdates(updates, update4, seenIds);
    updates = socketResult.updates;

    expect(updates).toHaveLength(1);
    expect(socketResult.hasChanged).toBe(false);
    expect(socketResult.lastProcessedSequence).toBe(4);

    // 3. Arrival via Reconnection Recovery API (duplicate arrival)
    const recoveryResult = processIncomingUpdates(updates, [update4], seenIds);
    updates = recoveryResult.updates;

    expect(updates).toHaveLength(1);
    expect(recoveryResult.hasChanged).toBe(false);
    expect(recoveryResult.lastProcessedSequence).toBe(4);

    // Final assertion: update 4 appears exactly once despite arriving 3 times
    expect(updates).toHaveLength(1);
    expect(updates[0].sequence).toBe(4);
    expect(updates[0].message).toBe('Database connection restored');
  });

  it('correctly incorporates new distinct updates while discarding duplicates in batch recovery', () => {
    const seenIds = new Set(['65f1234567890abcdef00004']);
    const currentUpdates = [
      {
        _id: '65f1234567890abcdef00004',
        incidentId: 'incident-1',
        sequence: 4,
        message: 'Database connection restored'
      }
    ];

    // Batch contains already seen update 4 and new update 5
    const batch = [
      {
        _id: '65f1234567890abcdef00004', // duplicate
        incidentId: 'incident-1',
        sequence: 4,
        message: 'Database connection restored'
      },
      {
        _id: '65f1234567890abcdef00005', // new
        incidentId: 'incident-1',
        sequence: 5,
        message: 'All services nominal'
      }
    ];

    const result = processIncomingUpdates(currentUpdates, batch, seenIds);

    expect(result.updates).toHaveLength(2);
    expect(result.updates.map((u) => u.sequence)).toEqual([4, 5]);
    expect(result.lastProcessedSequence).toBe(5);
    expect(seenIds.size).toBe(2);
  });
});
