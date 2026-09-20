# Caygnus Product Engineering Challenge — Problem 3: Reconnecting Real-Time Feed

A resilient, reliable, and observable real-time incident feed demonstrating durable event storage, server-assigned monotonic sequence numbers, Socket.IO real-time delivery, bounded cursor-based recovery, client-side deduplication, and deterministic sequence ordering.

---

## 1. Project Title
**Caygnus Product Engineering Challenge — Problem 3: Reconnecting Real-Time Feed**

---

## 2. Problem Statement
In mission-critical operational feeds (such as incident feeds, status pages, or telemetry streams), network partitions, client tab backgrounding, and flaky connections cause clients to drop transient WebSocket connections. Traditional naive real-time architectures suffer from:
- **Lost updates**: Events broadcast while a client was disconnected are permanently missed.
- **Race conditions**: Live events arriving while a client is fetching missed history cause duplicates or out-of-order rendering.
- **Timestamp unreliability**: Relying on client or server timestamps for ordering and pagination causes collisions, clock drift anomalies, and duplicate or missing events.
- **Silent failure**: UIs that falsely display "Connected" when the socket has dropped.

This project implements a complete, runnable solution where:
- Updates are durably persisted in MongoDB *before* real-time broadcast.
- Monotonically increasing sequence numbers serve as the immutable cursor and ordering authority.
- Reconnecting clients automatically recover missed updates using their last processed sequence.
- Centralized client deduplication and stable sorting guarantee that every update is displayed exactly once and in strict ascending sequence order.

---

## 3. Features
- **Durable Event History**: All incident updates are stored permanently in MongoDB with a unique compound index on `{ incidentId, sequence }`.
- **Atomic Sequence Allocation**: Monotonically increasing sequence counter per incident using MongoDB's atomic `findOneAndUpdate` with `$inc`.
- **Strict Persistence-Before-Broadcast**: Updates are committed to the database before any Socket.IO broadcast event is emitted.
- **Automatic Reconnection & Missed-Update Recovery**: When a client reconnects, it queries `/api/incidents/:id/updates?after=<lastSeq>` to backfill missed events.
- **Centralized Client Deduplication**: Overlapping updates from initial history, live socket events, and recovery replay are deduplicated via stable update `_id`s.
- **Deterministic Ascending Order**: Feed items are always sorted by server-assigned sequence number, independent of network arrival order.
- **Visible Connection States**: Explicit UI states: `Connecting`, `Connected`, `Reconnecting`, and `Disconnected`.
- **Bounded Pagination**: Cursor-based recovery with bounded limits to prevent unbounded memory usage.
- **Incident Room Isolation**: Backend and socket rooms strictly isolate feeds by `incidentId` (e.g., `incident:incident-1`).
- **Interactive Reconnection Demo Control**: UI includes a toggle button to disconnect and reconnect the real Socket.IO client to test recovery live.

---

## 4. Architecture
The architecture cleanly separates durable storage from transient real-time distribution:

```
[Browser Client A]                 [Express / Node.js API]                [MongoDB]
        │                                    │                                │
        ├── 1. POST /updates ───────────────►│                                │
        │   { message: "..." }               ├── 2. Validate input            │
        │                                    ├── 3. Atomic Sequence Increment─►│ (Counter)
        │                                    │◄──   Sequence = N ─────────────┤
        │                                    ├── 4. Insert IncidentUpdate ───►│
        │                                    │◄──   Write Confirmed ──────────┤
        │                                    ├── 5. Socket.IO Broadcast ──┐   │
        │                                    │      (incident:update)     │   │
        │◄── 6. Return 201 Response ─────────┤                            │   │
                                                                          │   │
[Browser Client B] (Connected)                                            │   │
        │◄── 7. Receives live broadcast ──────────────────────────────────┘   │
        ├── 8. processIncomingUpdates(update)                                 │
        └── 9. Deduplicate via _id, sort by sequence, advance cursor          │
                                                                              │
[Browser Client B] (Reconnecting)                                             │
        ├── 1. Socket.IO Reconnects ──► changes state to Connected/Recovering │
        ├── 2. GET /updates?after=lastProcessedSequence ─────────────────────►│
        │◄── 3. Receives missing updates ─────────────────────────────────────┘
        ├── 4. processIncomingUpdates(batch)
        └── 5. Deduplicate against any in-flight live events, sort by sequence
```

---

## 5. Data Flow
1. **Publishing**:
   - Client sends HTTP `POST /api/incidents/:incidentId/updates`.
   - Controller validates message (non-empty string, trimmed, $\le 500$ characters).
   - Sequence Service atomically increments the incident counter in MongoDB.
   - Update Service persists the `IncidentUpdate` record to MongoDB.
   - *Only after successful persistence*, Socket.IO emits `incident:update` to room `incident:<incidentId>`.
   - HTTP 201 response returns the persisted document to the publisher.

2. **Real-time Consumption**:
   - Connected clients in room `incident:<incidentId>` receive the `incident:update` event.
   - The payload passes through `processIncomingUpdates()`.
   - If `_id` is already in `seenUpdates`, it is ignored. Otherwise, it is appended, sorted by sequence ascending, and `lastProcessedSequence` is updated.

3. **Reconnection & Recovery**:
   - If the connection drops, Socket.IO updates state to `Reconnecting` and performs bounded backoff.
   - Upon reconnecting, the client re-joins room `incident:<incidentId>` and fires `recoverMissedUpdates()`.
   - The client calls `GET /api/incidents/:incidentId/updates?after=${lastProcessedSequence}`.
   - Recovered updates pass through `processIncomingUpdates()`, deduplicating seamlessly against any live events that may have arrived concurrently during the HTTP request.

---

## 6. Tech Stack
- **Frontend**: React (v18, functional components + hooks only), Vite, JavaScript (ESM), Bootstrap 5, Axios, Socket.IO Client.
- **Backend**: Node.js (v20+), Express.js, JavaScript (CommonJS), Socket.IO, Mongoose.
- **Database**: MongoDB (v6+ or MongoDB Memory Server for testing).
- **Testing**: Vitest, Supertest, mongodb-memory-server, socket.io-client.

---

## 7. Why Socket.IO?
- **Built-in Reconnection with Backoff**: Socket.IO provides battle-tested reconnection loops, exponential backoff, and event hooks (`connect`, `disconnect`, `reconnect_attempt`, `reconnect_failed`), avoiding brittle ad-hoc retry loops.
- **Room Isolation**: First-class room abstraction (`socket.join('incident:incident-1')`) guarantees that broadcast traffic is partitioned per incident.
- **Transport Fallback**: Gracefully falls back from WebSocket to HTTP long-polling if restrictive proxies or firewalls block raw WebSockets.

---

## 8. Why MongoDB?
- **Atomic In-Place Modifications**: Operators like `findOneAndUpdate` with `$inc` and `upsert: true` allow single-roundtrip atomic counter increments without distributed lock overhead.
- **Document Model**: Natural fit for structured incident updates with nested metadata and timestamp fields.
- **Unique Compound Indexes**: Enforces uniqueness across `{ incidentId: 1, sequence: 1 }` directly at the database engine level, preventing duplicate sequence assignments.

---

## 9. Sequence / Cursor Mechanism
- Each incident maintains an isolated sequence counter in the `Counter` collection:
  ```json
  { "_id": "incident-1", "sequence": 4 }
  ```
- Incremented atomically via `findOneAndUpdate({ _id: incidentId }, { $inc: { sequence: 1 } }, { upsert: true, new: true })`.
- **Why not timestamps?** Timestamps are vulnerable to system clock skew, NTP adjustments, identical millisecond collisions, and timezone discrepancies. Monotonic sequence numbers guarantee total ordering and deterministic `sequence > cursor` recovery.

---

## 10. Recovery Mechanism
- When recovering, the client queries:
  ```
  GET /api/incidents/incident-1/updates?after=5&limit=50
  ```
- The server executes:
  ```javascript
  IncidentUpdate.find({ incidentId: 'incident-1', sequence: { $gt: 5 } })
    .sort({ sequence: 1 })
    .limit(limit + 1)
  ```
- The response returns `{ updates: [...], nextCursor: 8, hasMore: false }`.
- If `hasMore: true`, the client continues paging until caught up.

---

## 11. Deduplication Mechanism
- Every update has a MongoDB-assigned immutable `_id` (e.g., `65f...`).
- The client maintains a `seenUpdatesRef` (`useRef(new Set())`) containing all processed `_id`s.
- When an update arrives (via history, socket broadcast, or recovery replay):
  ```javascript
  if (seenIds.has(String(update._id))) {
    return; // Ignore duplicate
  }
  seenIds.add(String(update._id));
  ```
- Because identity is keyed on `_id`, identical events arriving concurrently across multiple channels are safely deduplicated.

---

## 12. Stable Ordering
- Network packets and HTTP responses can arrive out of order (e.g. sequence 5 arrives before sequence 3 and 4).
- The client-side processor sorts the array by sequence ascending:
  ```javascript
  nextList.sort((a, b) => Number(a.sequence) - Number(b.sequence));
  ```
- The feed is always rendered in ascending order `1, 2, 3, 4, 5...`.

---

## 13. Connection States
The UI visibly represents 4 connection states:
1. **Connecting**: Socket client is establishing the initial handshake.
2. **Connected**: Socket client is active, registered in the incident room, and receiving real-time broadcasts.
3. **Reconnecting**: Connection was lost; Socket.IO is executing exponential backoff retries (showing attempt count).
4. **Disconnected**: Connection closed manually, or maximum reconnect attempts exhausted.

---

## 14. Setup Prerequisites
- **Node.js**: v18.x or v20+ (tested on Node v24.14.0)
- **npm**: v9.x or v11+
- **MongoDB**: A running local MongoDB instance (`mongodb://localhost:27017`) or MongoDB Atlas URI (Note: automated tests use an isolated in-memory MongoDB and require no external database).

---

## 15. Environment Variables

### Backend (`server/.env`):
```env
PORT=5000
MONGO_URI=mongodb://localhost:27017/incident_feed
CLIENT_URL=http://localhost:5173
```

### Frontend (`client/.env`):
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

---

## 16. Backend Setup
```bash
cd server
npm install
cp .env.example .env
```

---

## 17. Frontend Setup
```bash
cd client
npm install
cp .env.example .env
```

---

## 18. Running the Application

### Option A: From root directory
```bash
# Terminal 1: Run Backend
npm run dev:server

# Terminal 2: Run Frontend
npm run dev:client
```

### Option B: In individual directories
```bash
# Terminal 1: Backend
cd server
npm run dev

# Terminal 2: Frontend
cd client
npm run dev
```

Open your browser at `http://localhost:5173`.

---

## 19. Running Tests
Automated tests use Vitest and an isolated in-memory MongoDB instance (`mongodb-memory-server`):
```bash
cd server
npm test
```
Or from the root directory:
```bash
npm test
```

### Test Suite Summary:
- **TEST 1 (`live-update.test.js`)**: Verifies HTTP POST publishes an update, allocates an atomic sequence, persists to MongoDB, and delivers it via Socket.IO to connected room listeners.
- **TEST 2 (`recovery.test.js`)**: Verifies query replay `?after=3` returns sequences 4 and 5 in ascending order, excludes 1-3, and strictly isolates other incidents.
- **TEST 3 (`deduplication.test.js`)**: Verifies that delivering the same logical update via initial history, live socket broadcast, and recovery replay results in exactly one visible update.
- **TEST 4 (`ordering.test.js`)**: Verifies that out-of-order arrival (5, 3, 4) produces deterministic ascending ordering (3, 4, 5) and duplicate events do not alter the sequence cursor.

---

## 20. API Endpoints

| Method | Endpoint | Description | Query Parameters / Body |
|---|---|---|---|
| `GET` | `/api/health` | Health status and DB connection state | None |
| `GET` | `/api/incidents/:id/updates` | Retrieve bounded incident updates | `?after=<seq>&limit=<n>` |
| `POST` | `/api/incidents/:id/updates` | Publish and persist a new update | Body: `{ "message": "string" }` |

---

## 21. Socket.IO Events

| Direction | Event Name | Payload | Description |
|---|---|---|---|
| Client $\to$ Server | `incident:join` | `{ incidentId: "incident-1" }` | Client joins room `incident:<incidentId>` |
| Server $\to$ Client | `incident:update` | `{ _id, incidentId, sequence, message, createdAt }` | Broadcasts persisted update to room |

---

## 22. Acceptance Scenario Walkthrough

### Live Update:
1. Open two browser windows side-by-side at `http://localhost:5173`.
2. Both show `Status: Connected` on `incident-1`.
3. In Window A, type: `"Database investigation started"` and click **Send Update**.
4. Window B immediately renders update `#1` with timestamp without manual refresh.

### Disconnection & Recovery:
1. In Window B, click **Simulate Disconnect**. Status changes to `Disconnected`.
2. In Window A, publish two more updates:
   - Update `#2`: `"Identified high connection pool wait times"`
   - Update `#3`: `"Restarted connection pool"`
3. In Window B, click **Reconnect Socket**.
4. Window B status switches to `Connected`, displays `Recovering missed updates...`, queries `/updates?after=1`, receives updates `#2` and `#3`, and renders them in order without duplicates.

---

## 23. Assumptions
- Feed scope: Prototype UI focuses on `incident-1` (backend is fully multi-incident).
- Single server instance for the prototype.
- No authentication or authorization is required per challenge specifications.
- Message editing, reactions, and offline message queueing are out of scope.

---

## 24. Limitations
- Single-instance Socket.IO server: Does not include Redis Streams / RabbitMQ pub/sub across multiple cluster nodes.
- No offline message drafting: If the client is offline, POST requests fail until network returns.
- Bounded history: Replay is capped per request (max 100) using cursor pagination.
