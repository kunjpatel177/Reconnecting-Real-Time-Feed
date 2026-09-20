const http = require('http');
const request = require('supertest');
const { io: ClientIO } = require('socket.io-client');
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

const app = require('../src/app');
const { initSocket } = require('../src/socket/socketHandler');
const IncidentUpdate = require('../src/models/IncidentUpdate');
const Counter = require('../src/models/Counter');

describe('TEST 1: Live Update Publishing and Real-Time Delivery', () => {
  let mongoServer;
  let server;
  let port;
  let socketClient;

  beforeAll(async () => {
    // 1. Start in-memory MongoDB
    mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);

    // 2. Start HTTP & Socket.IO server
    server = http.createServer(app);
    const io = initSocket(server, '*');
    app.set('io', io);

    await new Promise((resolve) => {
      server.listen(0, () => {
        port = server.address().port;
        resolve();
      });
    });

    // 3. Connect a real Socket.IO client
    socketClient = ClientIO(`http://localhost:${port}`, {
      transports: ['websocket'],
      forceNew: true
    });

    await new Promise((resolve) => {
      socketClient.on('connect', () => {
        // Join incident-1 room
        socketClient.emit('incident:join', { incidentId: 'incident-1' }, (response) => {
          expect(response.success).toBe(true);
          resolve();
        });
      });
    });
  });

  afterAll(async () => {
    if (socketClient && socketClient.connected) {
      socketClient.disconnect();
    }
    if (server && server.listening) {
      await new Promise((resolve) => server.close(resolve));
    }
    await mongoose.disconnect();
    if (mongoServer) {
      await mongoServer.stop();
    }
  });

  it('publishes an update, assigns sequence, persists to MongoDB, and broadcasts to room listeners', async () => {
    const testMessage = 'Database investigation started';

    // Prepare listener for the real-time event
    const liveUpdatePromise = new Promise((resolve) => {
      socketClient.once('incident:update', (data) => {
        resolve(data);
      });
    });

    // Client publishes update via HTTP POST
    const res = await request(app)
      .post('/api/incidents/incident-1/updates')
      .send({ message: testMessage })
      .expect(201);

    // Verify HTTP response
    expect(res.body).toHaveProperty('_id');
    expect(res.body.incidentId).toBe('incident-1');
    expect(res.body.sequence).toBe(1);
    expect(res.body.message).toBe(testMessage);
    expect(res.body).toHaveProperty('createdAt');

    // Verify MongoDB durable persistence
    const savedDoc = await IncidentUpdate.findById(res.body._id).lean();
    expect(savedDoc).not.toBeNull();
    expect(savedDoc.sequence).toBe(1);
    expect(savedDoc.message).toBe(testMessage);

    // Verify Counter was updated
    const counterDoc = await Counter.findById('incident-1').lean();
    expect(counterDoc.sequence).toBe(1);

    // Verify Socket.IO listener received the broadcast persisted event
    const receivedEvent = await liveUpdatePromise;
    expect(receivedEvent._id).toBe(res.body._id);
    expect(receivedEvent.incidentId).toBe('incident-1');
    expect(receivedEvent.sequence).toBe(1);
    expect(receivedEvent.message).toBe(testMessage);
  });
});
