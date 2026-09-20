const request = require('supertest');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../src/app');
const IncidentUpdate = require('../src/models/IncidentUpdate');
const Counter = require('../src/models/Counter');

describe('TEST 2: Cursor-Based Replay and Incident Isolation', () => {
  let mongoServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // Seed 5 updates for incident-1
    for (let seq = 1; seq <= 5; seq++) {
      await IncidentUpdate.create({
        incidentId: 'incident-1',
        sequence: seq,
        message: `Incident 1 update sequence ${seq}`
      });
    }
    await Counter.create({ _id: 'incident-1', sequence: 5 });

    // Seed 2 updates for incident-2 (to test room/incident isolation)
    for (let seq = 1; seq <= 2; seq++) {
      await IncidentUpdate.create({
        incidentId: 'incident-2',
        sequence: seq,
        message: `Incident 2 update sequence ${seq}`
      });
    }
    await Counter.create({ _id: 'incident-2', sequence: 2 });
  });

  afterAll(async () => {
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('replays only missed updates after cursor in ascending order', async () => {
    const res = await request(app)
      .get('/api/incidents/incident-1/updates?after=3')
      .expect(200);

    expect(res.body).toHaveProperty('updates');
    expect(res.body).toHaveProperty('nextCursor', 5);
    expect(res.body).toHaveProperty('hasMore', false);

    const { updates } = res.body;

    // Verify exactly 2 updates returned
    expect(updates).toHaveLength(2);

    // Verify sequences 1, 2, 3 are excluded, and sequences 4, 5 are included
    const sequences = updates.map((u) => u.sequence);
    expect(sequences).toEqual([4, 5]);

    // Verify ordering is strictly ascending
    expect(updates[0].sequence).toBe(4);
    expect(updates[1].sequence).toBe(5);

    // Verify all updates belong to incident-1 and incident-2 is isolated
    updates.forEach((u) => {
      expect(u.incidentId).toBe('incident-1');
    });
  });

  it('strictly isolates incidents: queries on incident-2 return only incident-2 updates', async () => {
    const res = await request(app)
      .get('/api/incidents/incident-2/updates?after=0')
      .expect(200);

    expect(res.body.updates).toHaveLength(2);
    const sequences = res.body.updates.map((u) => u.sequence);
    expect(sequences).toEqual([1, 2]);

    res.body.updates.forEach((u) => {
      expect(u.incidentId).toBe('incident-2');
    });
  });

  it('handles bounded pagination and hasMore flag when limit is specified', async () => {
    const res = await request(app)
      .get('/api/incidents/incident-1/updates?after=1&limit=2')
      .expect(200);

    expect(res.body.updates).toHaveLength(2);
    expect(res.body.updates.map((u) => u.sequence)).toEqual([2, 3]);
    expect(res.body.nextCursor).toBe(3);
    expect(res.body.hasMore).toBe(true);
  });
});
