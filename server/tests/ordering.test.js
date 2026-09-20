const { processIncomingUpdates } = require('../src/utils/feedProcessor');

describe('TEST 4: Stable Sequence Ordering', () => {
  it('orders updates strictly ascending regardless of out-of-order arrival (5, 3, 4 -> 3, 4, 5)', () => {
    const seenIds = new Set();
    let updates = [];

    const update5 = {
      _id: 'id-005',
      incidentId: 'incident-1',
      sequence: 5,
      message: 'Mitigation applied'
    };

    const update3 = {
      _id: 'id-003',
      incidentId: 'incident-1',
      sequence: 3,
      message: 'Investigating root cause'
    };

    const update4 = {
      _id: 'id-004',
      incidentId: 'incident-1',
      sequence: 4,
      message: 'Fix identified'
    };

    // Arrive out of sequence order: 5 -> 3 -> 4
    let result = processIncomingUpdates(updates, update5, seenIds);
    updates = result.updates;
    expect(updates.map((u) => u.sequence)).toEqual([5]);
    expect(result.lastProcessedSequence).toBe(5);

    result = processIncomingUpdates(updates, update3, seenIds);
    updates = result.updates;
    // After 3 arrives, displayed order must be 3, 5
    expect(updates.map((u) => u.sequence)).toEqual([3, 5]);
    // lastProcessedSequence must reflect the highest processed sequence (5)
    expect(result.lastProcessedSequence).toBe(5);

    result = processIncomingUpdates(updates, update4, seenIds);
    updates = result.updates;
    // After 4 arrives, displayed order must be 3, 4, 5
    expect(updates.map((u) => u.sequence)).toEqual([3, 4, 5]);
    expect(result.lastProcessedSequence).toBe(5);

    // Verify ordering is strictly ascending
    expect(updates[0].sequence).toBe(3);
    expect(updates[1].sequence).toBe(4);
    expect(updates[2].sequence).toBe(5);
  });

  it('ensures duplicate arrivals do not alter the sequence cursor incorrectly', () => {
    const seenIds = new Set(['id-003', 'id-004', 'id-005']);
    const currentUpdates = [
      { _id: 'id-003', incidentId: 'incident-1', sequence: 3, message: 'Investigating' },
      { _id: 'id-004', incidentId: 'incident-1', sequence: 4, message: 'Fix identified' },
      { _id: 'id-005', incidentId: 'incident-1', sequence: 5, message: 'Mitigation applied' }
    ];

    // Re-submit duplicate update 3
    const duplicateUpdate3 = {
      _id: 'id-003',
      incidentId: 'incident-1',
      sequence: 3,
      message: 'Investigating'
    };

    const result = processIncomingUpdates(currentUpdates, duplicateUpdate3, seenIds);

    // List unchanged
    expect(result.updates).toHaveLength(3);
    expect(result.updates.map((u) => u.sequence)).toEqual([3, 4, 5]);
    // Cursor remains at the highest sequence (5), NOT reset to 3
    expect(result.lastProcessedSequence).toBe(5);
    expect(result.hasChanged).toBe(false);
  });
});
