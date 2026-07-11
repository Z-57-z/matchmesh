# MatchMesh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a stable hackathon demo of a Pears-powered P2P football watch room with chat, score predictions, reactions, MVP voting, README, and demo instructions.

**Architecture:** Use an Electron renderer for the UI, a sandboxed preload bridge for renderer-to-main IPC, and a Bare worker launched through `pear-runtime` for Hyperswarm peer discovery and event broadcasting. Keep room event creation and derived room state in pure CommonJS modules so they can be tested before the P2P layer is wired in.

**Tech Stack:** Node.js, npm, Electron, `pear-runtime`, Hyperswarm, `b4a`, built-in `node:test`, HTML/CSS/vanilla JavaScript.

---

## File Structure

- Create `package.json`: npm metadata, dependency versions, and scripts.
- Create `.gitignore`: ignores dependencies and local Electron output.
- Create `electron/main.js`: Electron window lifecycle, topic generation, worker startup, IPC bridge to renderer.
- Create `electron/preload.js`: exposes a narrow `window.matchmesh` API.
- Create `renderer/index.html`: app shell and DOM structure.
- Create `renderer/styles.css`: responsive hackathon-quality UI styling.
- Create `renderer/app.js`: UI state, event handlers, rendering, calls to `window.matchmesh`.
- Create `src/events.js`: creates validated room events with stable client sequence ids.
- Create `src/room-state.js`: deduplicates events and derives chat, predictions, reactions, MVP board, and peer count.
- Create `src/room-key.js`: converts match names and room keys into deterministic 32-byte topic hex values.
- Create `workers/main.mjs`: Bare worker using Hyperswarm to join a topic and broadcast JSON events.
- Create `test/events.test.js`: tests event creation and validation.
- Create `test/room-state.test.js`: tests deduplication and derived state.
- Create `test/room-key.test.js`: tests deterministic topic generation.
- Create `README.md`: setup, run, demo script, Pears usage, submission copy.

## Task 1: Project Skeleton and Test Runner

**Files:**
- Create: `package.json`
- Create: `.gitignore`

- [ ] **Step 1: Create package metadata**

Create `package.json`:

```json
{
  "name": "matchmesh",
  "version": "0.1.0",
  "description": "P2P football watch rooms for the Tether Developers Cup Pears track.",
  "main": "electron/main.js",
  "type": "commonjs",
  "scripts": {
    "start": "electron .",
    "test": "node --test"
  },
  "dependencies": {
    "b4a": "^1.6.7",
    "hyperswarm": "^4.17.0",
    "pear-runtime": "^1.1.4"
  },
  "devDependencies": {
    "electron": "^40.2.1"
  }
}
```

- [ ] **Step 2: Create ignore rules**

Create `.gitignore`:

```gitignore
node_modules/
npm-debug.log*
dist/
out/
.DS_Store
Thumbs.db
```

- [ ] **Step 3: Install dependencies**

Run: `npm install`

Expected: `package-lock.json` and `node_modules/` are created with no install errors.

- [ ] **Step 4: Run the empty test suite**

Run: `npm test`

Expected: the command exits successfully with zero tests or reports no matching tests.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .gitignore
git commit -m "chore: scaffold MatchMesh project"
```

## Task 2: Room Key Topic Generation

**Files:**
- Create: `src/room-key.js`
- Create: `test/room-key.test.js`

- [ ] **Step 1: Write room key tests**

Create `test/room-key.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { createRoomKey, topicFromRoomKey, normalizeRoomKey } = require('../src/room-key')

test('createRoomKey creates a readable key from match name', () => {
  const key = createRoomKey('Brazil vs Spain')
  assert.equal(key, 'brazil-vs-spain')
})

test('normalizeRoomKey trims and lowercases user input', () => {
  assert.equal(normalizeRoomKey('  Brazil-VS-Spain  '), 'brazil-vs-spain')
})

test('topicFromRoomKey returns deterministic 64 character hex topic', () => {
  const first = topicFromRoomKey('brazil-vs-spain')
  const second = topicFromRoomKey('Brazil VS Spain')
  assert.equal(first, second)
  assert.match(first, /^[a-f0-9]{64}$/)
})

test('topicFromRoomKey rejects empty keys', () => {
  assert.throws(() => topicFromRoomKey('   '), /Room key is required/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/room-key.test.js`

Expected: FAIL with `Cannot find module '../src/room-key'`.

- [ ] **Step 3: Implement room key helpers**

Create `src/room-key.js`:

```js
const nodeCrypto = typeof require === 'function' ? require('node:crypto') : null

function normalizeRoomKey(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createRoomKey(matchName) {
  const key = normalizeRoomKey(matchName)
  if (!key) throw new Error('Match name is required')
  return key
}

function topicFromRoomKey(roomKey) {
  const normalized = normalizeRoomKey(roomKey)
  if (!normalized) throw new Error('Room key is required')
  if (!nodeCrypto) throw new Error('Topic generation is only available in the Electron main process')

  return nodeCrypto
    .createHash('sha256')
    .update(`matchmesh:${normalized}`)
    .digest('hex')
}

const api = {
  createRoomKey,
  normalizeRoomKey,
  topicFromRoomKey
}

if (typeof module !== 'undefined') module.exports = api
if (typeof window !== 'undefined') {
  window.MatchMeshCore = Object.assign(window.MatchMeshCore || {}, api)
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/room-key.test.js`

Expected: PASS for all four tests.

- [ ] **Step 5: Commit**

```bash
git add src/room-key.js test/room-key.test.js
git commit -m "feat: add room key topic helpers"
```

## Task 3: Event Creation

**Files:**
- Create: `src/events.js`
- Create: `test/events.test.js`

- [ ] **Step 1: Write event creation tests**

Create `test/events.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { createEventFactory } = require('../src/events')

test('createEventFactory creates sequential event ids', () => {
  const events = createEventFactory({ clientId: 'alice', now: () => '2026-07-12T00:00:00.000Z' })

  const first = events.create('chat.sent', 'brazil-vs-spain', { text: 'hello' })
  const second = events.create('reaction.cast', 'brazil-vs-spain', { reaction: 'Goal soon' })

  assert.equal(first.id, 'alice:1')
  assert.equal(second.id, 'alice:2')
  assert.equal(first.clientId, 'alice')
  assert.equal(first.createdAt, '2026-07-12T00:00:00.000Z')
})

test('event factory rejects missing type', () => {
  const events = createEventFactory({ clientId: 'alice' })
  assert.throws(() => events.create('', 'room', {}), /Event type is required/)
})

test('event factory rejects missing room id', () => {
  const events = createEventFactory({ clientId: 'alice' })
  assert.throws(() => events.create('chat.sent', '', {}), /Room id is required/)
})

test('event factory requires a client id', () => {
  assert.throws(() => createEventFactory({ clientId: '' }), /Client id is required/)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/events.test.js`

Expected: FAIL with `Cannot find module '../src/events'`.

- [ ] **Step 3: Implement event factory**

Create `src/events.js`:

```js
function createEventFactory({ clientId, now = () => new Date().toISOString() }) {
  if (!clientId) throw new Error('Client id is required')

  let sequence = 0

  return {
    create(type, roomId, payload) {
      if (!type) throw new Error('Event type is required')
      if (!roomId) throw new Error('Room id is required')

      sequence += 1

      return {
        id: `${clientId}:${sequence}`,
        type,
        roomId,
        clientId,
        createdAt: now(),
        payload: payload || {}
      }
    }
  }
}

const api = {
  createEventFactory
}

if (typeof module !== 'undefined') module.exports = api
if (typeof window !== 'undefined') {
  window.MatchMeshCore = Object.assign(window.MatchMeshCore || {}, api)
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/events.test.js`

Expected: PASS for all four tests.

- [ ] **Step 5: Commit**

```bash
git add src/events.js test/events.test.js
git commit -m "feat: add room event factory"
```

## Task 4: Room State Derivation

**Files:**
- Create: `src/room-state.js`
- Create: `test/room-state.test.js`

- [ ] **Step 1: Write state tests**

Create `test/room-state.test.js`:

```js
const test = require('node:test')
const assert = require('node:assert/strict')
const { createRoomState } = require('../src/room-state')

function event(id, type, clientId, payload, createdAt = '2026-07-12T00:00:00.000Z') {
  return { id, type, roomId: 'brazil-vs-spain', clientId, createdAt, payload }
}

test('room state deduplicates events by id', () => {
  const room = createRoomState()
  const chat = event('alice:1', 'chat.sent', 'alice', { displayName: 'Alice', text: 'hello' })

  assert.equal(room.addEvent(chat), true)
  assert.equal(room.addEvent(chat), false)
  assert.equal(room.getSnapshot().chat.length, 1)
})

test('room state derives chat in timestamp order', () => {
  const room = createRoomState()
  room.addEvent(event('bob:1', 'chat.sent', 'bob', { displayName: 'Bob', text: 'second' }, '2026-07-12T00:00:02.000Z'))
  room.addEvent(event('alice:1', 'chat.sent', 'alice', { displayName: 'Alice', text: 'first' }, '2026-07-12T00:00:01.000Z'))

  assert.deepEqual(room.getSnapshot().chat.map((item) => item.text), ['first', 'second'])
})

test('room state keeps latest prediction per client', () => {
  const room = createRoomState()
  room.addEvent(event('alice:1', 'prediction.submitted', 'alice', { displayName: 'Alice', score: '1-1' }))
  room.addEvent(event('alice:2', 'prediction.submitted', 'alice', { displayName: 'Alice', score: '2-1' }))

  assert.deepEqual(room.getSnapshot().predictions, [
    { clientId: 'alice', displayName: 'Alice', score: '2-1' }
  ])
})

test('room state counts reactions and MVP votes', () => {
  const room = createRoomState()
  room.addEvent(event('alice:1', 'reaction.cast', 'alice', { reaction: 'Goal soon' }))
  room.addEvent(event('bob:1', 'reaction.cast', 'bob', { reaction: 'Goal soon' }))
  room.addEvent(event('alice:2', 'mvp.cast', 'alice', { player: 'Marta' }))

  assert.deepEqual(room.getSnapshot().reactions, { 'Goal soon': 2 })
  assert.deepEqual(room.getSnapshot().mvpVotes, { Marta: 1 })
})

test('room state stores peer count from worker events', () => {
  const room = createRoomState()
  room.setPeerCount(2)
  assert.equal(room.getSnapshot().peerCount, 2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- test/room-state.test.js`

Expected: FAIL with `Cannot find module '../src/room-state'`.

- [ ] **Step 3: Implement room state**

Create `src/room-state.js`:

```js
function createRoomState() {
  const eventIds = new Set()
  const events = []
  let peerCount = 0

  function addEvent(event) {
    if (!event || !event.id || eventIds.has(event.id)) return false
    eventIds.add(event.id)
    events.push(event)
    events.sort(compareEvents)
    return true
  }

  function setPeerCount(count) {
    peerCount = Number.isFinite(count) ? count : 0
  }

  function getSnapshot() {
    const chat = []
    const predictionsByClient = new Map()
    const reactions = {}
    const mvpVotes = {}

    for (const event of events) {
      if (event.type === 'chat.sent') {
        chat.push({
          id: event.id,
          clientId: event.clientId,
          displayName: event.payload.displayName,
          text: event.payload.text,
          createdAt: event.createdAt
        })
      }

      if (event.type === 'prediction.submitted') {
        predictionsByClient.set(event.clientId, {
          clientId: event.clientId,
          displayName: event.payload.displayName,
          score: event.payload.score
        })
      }

      if (event.type === 'reaction.cast') {
        reactions[event.payload.reaction] = (reactions[event.payload.reaction] || 0) + 1
      }

      if (event.type === 'mvp.cast') {
        mvpVotes[event.payload.player] = (mvpVotes[event.payload.player] || 0) + 1
      }
    }

    return {
      peerCount,
      chat,
      predictions: Array.from(predictionsByClient.values()),
      reactions,
      mvpVotes,
      events: events.slice()
    }
  }

  return {
    addEvent,
    setPeerCount,
    getSnapshot
  }
}

function compareEvents(left, right) {
  const byTime = String(left.createdAt).localeCompare(String(right.createdAt))
  if (byTime !== 0) return byTime
  return String(left.id).localeCompare(String(right.id))
}

const api = {
  createRoomState
}

if (typeof module !== 'undefined') module.exports = api
if (typeof window !== 'undefined') {
  window.MatchMeshCore = Object.assign(window.MatchMeshCore || {}, api)
}
```

- [ ] **Step 4: Run tests**

Run: `npm test -- test/room-state.test.js`

Expected: PASS for all five tests.

- [ ] **Step 5: Run all tests**

Run: `npm test`

Expected: PASS for `room-key`, `events`, and `room-state`.

- [ ] **Step 6: Commit**

```bash
git add src/room-state.js test/room-state.test.js
git commit -m "feat: derive room state from events"
```

## Task 5: Electron Shell and Preload Bridge

**Files:**
- Create: `electron/main.js`
- Create: `electron/preload.js`
- Create: `renderer/index.html`
- Create: `renderer/styles.css`
- Create: `renderer/app.js`

- [ ] **Step 1: Create Electron main process**

Create `electron/main.js`:

```js
const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const crypto = require('node:crypto')
const PearRuntime = require('pear-runtime')
const { topicFromRoomKey } = require('../src/room-key')

let windowRef = null
let worker = null
let activeRoomKey = null

function createWindow() {
  windowRef = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    title: 'MatchMesh',
    backgroundColor: '#f5f3ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  windowRef.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

function startWorker(roomKey) {
  if (worker) worker.destroy()

  activeRoomKey = roomKey
  const workerPath = path.join(__dirname, '..', 'workers', 'main.mjs')
  const topic = topicFromRoomKey(roomKey)
  const clientId = crypto.randomBytes(4).toString('hex')

  worker = PearRuntime.run(workerPath, [topic, clientId])

  worker.on('data', (data) => {
    if (!windowRef || windowRef.isDestroyed()) return
    windowRef.webContents.send('matchmesh:worker-message', data.toString())
  })

  worker.stderr.on('data', (data) => {
    if (!windowRef || windowRef.isDestroyed()) return
    windowRef.webContents.send('matchmesh:worker-error', data.toString())
  })

  worker.once('close', () => {
    worker = null
    if (!windowRef || windowRef.isDestroyed()) return
    windowRef.webContents.send('matchmesh:worker-message', JSON.stringify({ type: 'status', status: 'closed' }))
  })

  return { clientId, roomKey: activeRoomKey }
}

ipcMain.handle('matchmesh:start-room', (_event, roomKey) => {
  return startWorker(roomKey)
})

ipcMain.handle('matchmesh:send-event', (_event, roomEvent) => {
  if (!worker) throw new Error('Room worker is not running')
  worker.write(Buffer.from(JSON.stringify({ type: 'event', event: roomEvent })))
  return true
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (worker) worker.destroy()
  app.quit()
})
```

- [ ] **Step 2: Create preload bridge**

Create `electron/preload.js`:

```js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('matchmesh', {
  startRoom(roomKey) {
    return ipcRenderer.invoke('matchmesh:start-room', roomKey)
  },
  sendEvent(roomEvent) {
    return ipcRenderer.invoke('matchmesh:send-event', roomEvent)
  },
  onWorkerMessage(listener) {
    const wrapped = (_event, payload) => listener(JSON.parse(payload))
    ipcRenderer.on('matchmesh:worker-message', wrapped)
    return () => ipcRenderer.removeListener('matchmesh:worker-message', wrapped)
  },
  onWorkerError(listener) {
    const wrapped = (_event, payload) => listener(payload)
    ipcRenderer.on('matchmesh:worker-error', wrapped)
    return () => ipcRenderer.removeListener('matchmesh:worker-error', wrapped)
  }
})
```

- [ ] **Step 3: Create temporary renderer**

Create `renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>MatchMesh</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main id="app" class="app-shell">
      <section class="panel">
        <p class="eyebrow">Pears P2P football rooms</p>
        <h1>MatchMesh</h1>
        <p>Create a watch room, share the key, and sync fan predictions without a central server.</p>
      </section>
    </main>
    <script src="../src/events.js"></script>
    <script src="../src/room-state.js"></script>
    <script src="../src/room-key.js"></script>
    <script src="./app.js"></script>
  </body>
</html>
```

Create `renderer/styles.css`:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #17211b;
  background: #f5f3ee;
}

.app-shell {
  min-height: 100vh;
  padding: 32px;
}

.panel {
  max-width: 760px;
}

.eyebrow {
  margin: 0 0 12px;
  color: #496453;
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0 0 12px;
  font-size: 56px;
  line-height: 1;
}
```

Create `renderer/app.js`:

```js
console.log('MatchMesh renderer ready')
```

- [ ] **Step 4: Launch app**

Run: `npm start`

Expected: Electron window opens with the MatchMesh title panel.

- [ ] **Step 5: Commit**

```bash
git add electron/main.js electron/preload.js renderer/index.html renderer/styles.css renderer/app.js
git commit -m "feat: add Electron shell"
```

## Task 6: Hyperswarm Worker

**Files:**
- Create: `workers/main.mjs`

- [ ] **Step 1: Create P2P worker**

Create `workers/main.mjs`:

```js
import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'

const topic = b4a.from(Bare.argv[2], 'hex')
const clientId = Bare.argv[3]
const swarm = new Hyperswarm()
const conns = new Set()

function sendToMain(message) {
  Bare.IPC.write(JSON.stringify(message))
}

function broadcast(message) {
  const data = JSON.stringify(message)
  for (const conn of conns) {
    conn.write(data)
  }
}

swarm.on('connection', (conn) => {
  conns.add(conn)
  sendToMain({ type: 'peers', count: conns.size })

  conn.on('data', (data) => {
    try {
      const message = JSON.parse(b4a.toString(data))
      sendToMain(message)
    } catch {
      sendToMain({ type: 'warning', warning: 'Ignored malformed peer message' })
    }
  })

  conn.on('error', () => {})

  conn.once('close', () => {
    conns.delete(conn)
    sendToMain({ type: 'peers', count: conns.size })
  })
})

Bare.IPC.on('data', (data) => {
  try {
    const message = JSON.parse(b4a.toString(data))
    if (message.type === 'event') {
      broadcast({ type: 'event', event: message.event })
    }
  } catch {
    sendToMain({ type: 'warning', warning: 'Ignored malformed local message' })
  }
})

await swarm.join(topic, { client: true, server: true }).flushed()
sendToMain({ type: 'ready', clientId })
```

- [ ] **Step 2: Run app with worker**

Run: `npm start`

Expected: Electron window still opens. No worker error appears in the terminal.

- [ ] **Step 3: Commit**

```bash
git add workers/main.mjs
git commit -m "feat: add Hyperswarm worker"
```

## Task 7: Full MatchMesh UI

**Files:**
- Modify: `renderer/index.html`
- Modify: `renderer/styles.css`
- Modify: `renderer/app.js`

- [ ] **Step 1: Replace HTML with full layout**

Replace `renderer/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>MatchMesh</title>
    <link rel="stylesheet" href="./styles.css">
  </head>
  <body>
    <main class="app-shell">
      <section id="launcher" class="launcher">
        <div class="intro">
          <p class="eyebrow">Pears P2P football rooms</p>
          <h1>MatchMesh</h1>
          <p class="lede">Create a watch room, share the key, and sync fan predictions without a central server.</p>
        </div>

        <form id="room-form" class="launcher-form">
          <label>
            Display name
            <input id="display-name" autocomplete="name" value="Fan One" required>
          </label>
          <label>
            Match name
            <input id="match-name" value="Brazil vs Spain" required>
          </label>
          <label>
            Room key
            <input id="room-key" placeholder="Leave blank to create from match name">
          </label>
          <div class="actions">
            <button id="create-room" type="submit" data-mode="create">Create Room</button>
            <button id="join-room" type="submit" data-mode="join">Join Room</button>
          </div>
          <p id="launcher-error" class="error" role="alert"></p>
        </form>
      </section>

      <section id="room" class="room hidden">
        <header class="room-header">
          <div>
            <p class="eyebrow">Live watch room</p>
            <h2 id="room-title">Match room</h2>
            <p id="connection-status">Starting room...</p>
          </div>
          <div class="room-key-box">
            <span>Room key</span>
            <strong id="active-room-key"></strong>
          </div>
        </header>

        <section class="grid">
          <article class="board chat-board">
            <h3>Fan Chat</h3>
            <div id="chat-list" class="chat-list"></div>
            <form id="chat-form" class="inline-form">
              <input id="chat-input" placeholder="Send a match thought" required>
              <button type="submit">Send</button>
            </form>
          </article>

          <article class="board">
            <h3>Score Predictions</h3>
            <form id="prediction-form" class="inline-form">
              <input id="prediction-input" placeholder="2-1" required>
              <button type="submit">Predict</button>
            </form>
            <div id="prediction-list" class="stack-list"></div>
          </article>

          <article class="board">
            <h3>Match Pulse</h3>
            <div id="reaction-buttons" class="button-grid"></div>
            <div id="reaction-list" class="stack-list"></div>
          </article>

          <article class="board">
            <h3>MVP Vote</h3>
            <form id="mvp-form" class="inline-form">
              <input id="mvp-input" placeholder="Player name" required>
              <button type="submit">Vote</button>
            </form>
            <div id="mvp-list" class="stack-list"></div>
          </article>
        </section>
      </section>
    </main>

    <script src="../src/events.js"></script>
    <script src="../src/room-state.js"></script>
    <script src="../src/room-key.js"></script>
    <script src="./app.js"></script>
  </body>
</html>
```

- [ ] **Step 2: Replace styles**

Replace `renderer/styles.css` with the complete UI styles:

```css
* {
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #162019;
  background:
    linear-gradient(120deg, rgba(49, 104, 83, 0.14), transparent 38%),
    linear-gradient(220deg, rgba(212, 54, 66, 0.12), transparent 34%),
    #f6f3ec;
}

button,
input {
  font: inherit;
}

button {
  border: 0;
  border-radius: 8px;
  padding: 12px 16px;
  color: #ffffff;
  background: #1d6f51;
  font-weight: 800;
  cursor: pointer;
}

button:hover {
  background: #15563e;
}

input {
  width: 100%;
  border: 1px solid #c9d3c8;
  border-radius: 8px;
  padding: 12px 13px;
  color: #162019;
  background: #ffffff;
}

label {
  display: grid;
  gap: 7px;
  color: #46594d;
  font-size: 13px;
  font-weight: 800;
}

.hidden {
  display: none !important;
}

.app-shell {
  min-height: 100vh;
  padding: 28px;
}

.launcher {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 380px;
  gap: 32px;
  align-items: center;
  min-height: calc(100vh - 56px);
}

.intro h1 {
  margin: 0;
  max-width: 720px;
  font-size: clamp(56px, 11vw, 132px);
  line-height: 0.88;
}

.eyebrow {
  margin: 0 0 12px;
  color: #38634e;
  font-size: 12px;
  font-weight: 900;
  letter-spacing: 0;
  text-transform: uppercase;
}

.lede {
  max-width: 580px;
  color: #46594d;
  font-size: 20px;
  line-height: 1.5;
}

.launcher-form,
.board,
.room-key-box {
  border: 1px solid rgba(22, 32, 25, 0.12);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.86);
  box-shadow: 0 24px 70px rgba(21, 38, 30, 0.11);
}

.launcher-form {
  display: grid;
  gap: 16px;
  padding: 22px;
}

.actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.actions button:last-child {
  color: #1d6f51;
  background: #dcebe4;
}

.error {
  min-height: 20px;
  margin: 0;
  color: #aa2633;
  font-weight: 700;
}

.room {
  display: grid;
  gap: 22px;
}

.room-header {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  align-items: start;
}

.room-header h2 {
  margin: 0 0 8px;
  font-size: 44px;
}

.room-header p {
  margin: 0;
  color: #526056;
}

.room-key-box {
  min-width: 260px;
  padding: 16px;
}

.room-key-box span {
  display: block;
  margin-bottom: 6px;
  color: #637369;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.room-key-box strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 19px;
}

.grid {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  gap: 18px;
}

.board {
  display: grid;
  align-content: start;
  gap: 14px;
  min-height: 220px;
  padding: 18px;
}

.board h3 {
  margin: 0;
  font-size: 18px;
}

.chat-board {
  grid-row: span 2;
  min-height: 520px;
}

.chat-list,
.stack-list {
  display: grid;
  gap: 10px;
}

.chat-list {
  align-content: start;
  min-height: 360px;
  max-height: 460px;
  overflow: auto;
}

.chat-item,
.stack-item {
  border-radius: 8px;
  padding: 11px 12px;
  background: #f3f5ef;
}

.meta {
  color: #5f6c63;
  font-size: 12px;
  font-weight: 800;
}

.inline-form {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 10px;
}

.button-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.button-grid button {
  min-height: 48px;
  color: #173322;
  background: #e4ecdf;
}

@media (max-width: 820px) {
  .app-shell {
    padding: 18px;
  }

  .launcher,
  .grid,
  .room-header {
    grid-template-columns: 1fr;
  }

  .room-header {
    display: grid;
  }

  .chat-board {
    grid-row: auto;
  }

  .inline-form,
  .actions {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 3: Implement renderer behavior**

Replace `renderer/app.js`:

```js
const { createEventFactory, createRoomState, createRoomKey, normalizeRoomKey } = window.MatchMeshCore

const reactions = ['Goal soon', 'Great save', 'Pressure rising', 'What a pass']

const elements = {
  launcher: document.querySelector('#launcher'),
  room: document.querySelector('#room'),
  form: document.querySelector('#room-form'),
  displayName: document.querySelector('#display-name'),
  matchName: document.querySelector('#match-name'),
  roomKey: document.querySelector('#room-key'),
  error: document.querySelector('#launcher-error'),
  roomTitle: document.querySelector('#room-title'),
  status: document.querySelector('#connection-status'),
  activeRoomKey: document.querySelector('#active-room-key'),
  chatForm: document.querySelector('#chat-form'),
  chatInput: document.querySelector('#chat-input'),
  chatList: document.querySelector('#chat-list'),
  predictionForm: document.querySelector('#prediction-form'),
  predictionInput: document.querySelector('#prediction-input'),
  predictionList: document.querySelector('#prediction-list'),
  reactionButtons: document.querySelector('#reaction-buttons'),
  reactionList: document.querySelector('#reaction-list'),
  mvpForm: document.querySelector('#mvp-form'),
  mvpInput: document.querySelector('#mvp-input'),
  mvpList: document.querySelector('#mvp-list')
}

const roomState = createRoomState()
let eventFactory = null
let roomId = ''
let displayName = ''

for (const reaction of reactions) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = reaction
  button.addEventListener('click', () => sendRoomEvent('reaction.cast', { reaction }))
  elements.reactionButtons.append(button)
}

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault()
  const mode = event.submitter.dataset.mode
  displayName = elements.displayName.value.trim()
  const matchName = elements.matchName.value.trim()
  roomId = mode === 'join' ? normalizeRoomKey(elements.roomKey.value) : createRoomKey(matchName)

  if (!displayName) {
    elements.error.textContent = 'Display name is required.'
    return
  }

  if (!roomId) {
    elements.error.textContent = 'Room key is required to join.'
    return
  }

  try {
    const started = await window.matchmesh.startRoom(roomId)
    eventFactory = createEventFactory({ clientId: started.clientId })
    elements.roomTitle.textContent = matchName || roomId
    elements.activeRoomKey.textContent = roomId
    elements.launcher.classList.add('hidden')
    elements.room.classList.remove('hidden')
    elements.status.textContent = 'Room started. Waiting for fans to join.'

    if (mode === 'create') {
      sendRoomEvent('room.created', { matchName, displayName })
    }
  } catch (error) {
    elements.error.textContent = error.message
  }
})

elements.chatForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const text = elements.chatInput.value.trim()
  if (!text) return
  elements.chatInput.value = ''
  sendRoomEvent('chat.sent', { displayName, text })
})

elements.predictionForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const score = elements.predictionInput.value.trim()
  if (!score) return
  elements.predictionInput.value = ''
  sendRoomEvent('prediction.submitted', { displayName, score })
})

elements.mvpForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const player = elements.mvpInput.value.trim()
  if (!player) return
  elements.mvpInput.value = ''
  sendRoomEvent('mvp.cast', { displayName, player })
})

window.matchmesh.onWorkerMessage((message) => {
  if (message.type === 'ready') {
    elements.status.textContent = 'P2P topic joined. Waiting for fans to join.'
  }

  if (message.type === 'peers') {
    roomState.setPeerCount(message.count)
    elements.status.textContent = message.count > 0
      ? `${message.count} peer${message.count === 1 ? '' : 's'} connected.`
      : 'Waiting for fans to join.'
    render()
  }

  if (message.type === 'event') {
    roomState.addEvent(message.event)
    render()
  }
})

window.matchmesh.onWorkerError((message) => {
  elements.status.textContent = `Worker error: ${message}`
})

function sendRoomEvent(type, payload) {
  if (!eventFactory) return
  const roomEvent = eventFactory.create(type, roomId, payload)
  roomState.addEvent(roomEvent)
  render()
  window.matchmesh.sendEvent(roomEvent).catch((error) => {
    elements.status.textContent = error.message
  })
}

function render() {
  const snapshot = roomState.getSnapshot()
  elements.chatList.innerHTML = snapshot.chat.map((item) => `
    <div class="chat-item">
      <div class="meta">${escapeHtml(item.displayName || item.clientId)}</div>
      <div>${escapeHtml(item.text)}</div>
    </div>
  `).join('')

  elements.predictionList.innerHTML = snapshot.predictions.map((item) => `
    <div class="stack-item">
      <div class="meta">${escapeHtml(item.displayName || item.clientId)}</div>
      <strong>${escapeHtml(item.score)}</strong>
    </div>
  `).join('') || '<div class="stack-item">No predictions yet.</div>'

  elements.reactionList.innerHTML = Object.entries(snapshot.reactions).map(([reaction, count]) => `
    <div class="stack-item">${escapeHtml(reaction)}: <strong>${count}</strong></div>
  `).join('') || '<div class="stack-item">No reactions yet.</div>'

  elements.mvpList.innerHTML = Object.entries(snapshot.mvpVotes).map(([player, count]) => `
    <div class="stack-item">${escapeHtml(player)}: <strong>${count}</strong></div>
  `).join('') || '<div class="stack-item">No MVP votes yet.</div>'
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
```

- [ ] **Step 4: Launch app**

Run: `npm start`

Expected: Electron window opens with launcher. Creating a room moves to the dashboard.

- [ ] **Step 5: Commit**

```bash
git add renderer/index.html renderer/styles.css renderer/app.js
git commit -m "feat: build MatchMesh room UI"
```

## Task 8: Manual P2P Acceptance Test

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run tests before manual demo**

Run: `npm test`

Expected: all automated tests pass.

- [ ] **Step 2: Open first app window**

Run: `npm start`

Expected: launcher opens.

- [ ] **Step 3: Open second app window**

Run in another terminal: `npm start`

Expected: second launcher opens.

- [ ] **Step 4: Create and join a room**

In Window A:

- Display name: `Alice`
- Match name: `Brazil vs Spain`
- Click `Create Room`

In Window B:

- Display name: `Bob`
- Room key: `brazil-vs-spain`
- Click `Join Room`

Expected: both windows show a connected peer count.

- [ ] **Step 5: Verify event sync**

In Window A:

- Send chat: `Opening pressure looks intense`
- Submit prediction: `2-1`
- Click reaction: `Goal soon`

In Window B:

- Confirm A's chat, prediction, and reaction appear.
- Send chat: `Spain is controlling midfield`
- Submit prediction: `1-1`
- Vote MVP: `Marta`

Expected: both windows show both chats, both predictions, reaction count, and MVP vote.

- [ ] **Step 6: Create README manual test section**

Create or update `README.md` with this section:

```markdown
## Manual Demo Test

1. Run `npm install`.
2. Start one client with `npm start`.
3. Start a second client in another terminal with `npm start`.
4. In the first window, create `Brazil vs Spain` as `Alice`.
5. In the second window, join `brazil-vs-spain` as `Bob`.
6. Send chat, predictions, reactions, and MVP votes from both windows.

Expected result: both clients show matching room state without any app-owned backend server.
```

- [ ] **Step 7: Commit**

```bash
git add README.md
git commit -m "docs: add manual P2P demo test"
```

## Task 9: README and Submission Polish

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write complete README**

Replace `README.md`:

```markdown
# MatchMesh

MatchMesh is a serverless peer-to-peer football watch room for the Tether Developers Cup Pears track.

Fans create a match room, share a room key, and sync live chat, score predictions, match reactions, and MVP votes without running an app-owned backend server.

## Why Pears

MatchMesh uses the Pears stack shape from the official Pear chat guide:

- Electron provides the desktop app shell.
- `pear-runtime` starts a Bare worker from the app.
- The Bare worker uses Hyperswarm to join a shared topic derived from the room key.
- Room actions are JSON events broadcast directly between peers.
- Each client derives the visible room board locally from the event stream.

## Features

- Create or join a football watch room.
- Share a readable room key such as `brazil-vs-spain`.
- Send live fan chat.
- Submit one score prediction per fan.
- Cast quick match reactions.
- Vote for MVP.
- Demo with two local windows.

## Requirements

- Node.js v22.17 or newer.
- npm v10.9 or newer.

## Setup

```bash
npm install
```

## Run

```bash
npm start
```

To demo P2P sync locally, open two terminals and run `npm start` in both.

## Manual Demo Test

1. Run `npm install`.
2. Start one client with `npm start`.
3. Start a second client in another terminal with `npm start`.
4. In the first window, create `Brazil vs Spain` as `Alice`.
5. In the second window, join `brazil-vs-spain` as `Bob`.
6. Send chat, predictions, reactions, and MVP votes from both windows.

Expected result: both clients show matching room state without any app-owned backend server.

## Test

```bash
npm test
```

The automated tests cover room key topic generation, event creation, deduplication, and derived room state.

## Demo Video Script

1. Show the MatchMesh launcher.
2. Create `Brazil vs Spain` as Alice.
3. Open a second app window and join `brazil-vs-spain` as Bob.
4. Send chat from both windows.
5. Submit predictions from both windows.
6. Cast reactions and an MVP vote.
7. Explain that the room key maps to a Hyperswarm topic and events sync peer-to-peer through the Bare worker.

## Hackathon Submission

Title:

`MatchMesh - P2P Football Watch Rooms`

Short description:

`A serverless Pears app where football fans create peer-to-peer watch rooms for live chat, score predictions, reactions, and MVP voting.`
```

- [ ] **Step 2: Run full verification**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: polish hackathon README"
```

## Task 10: Final Verification and Push

**Files:**
- No source changes expected.

- [ ] **Step 1: Check repository state**

Run: `git status --short`

Expected: no unexpected untracked or modified files except files intentionally changed by the current task.

- [ ] **Step 2: Run automated tests**

Run: `npm test`

Expected: all tests pass.

- [ ] **Step 3: Run app smoke test**

Run: `npm start`

Expected: Electron opens, a room can be created, and no startup error appears.

- [ ] **Step 4: Push commits**

Run: `git push`

Expected: all commits are pushed to `origin/master`.

## Self-Review

Spec coverage:

- P2P room creation and joining are covered by Tasks 2, 5, 6, and 8.
- Chat, predictions, reactions, and MVP voting are covered by Tasks 3, 4, 7, and 8.
- No backend deployment is covered by the Electron plus Bare worker architecture in Tasks 5 and 6.
- README, demo script, and submission copy are covered by Tasks 8 and 9.
- Manual two-window demo is covered by Task 8.

Placeholder scan:

- The plan contains no TBD, TODO, or unspecified implementation steps.
- Each code-writing step includes full file content.

Type consistency:

- `roomId`, `clientId`, `createdAt`, `payload`, `displayName`, `score`, `reaction`, and `player` are used consistently across tests, state, renderer, and worker messages.
- Worker messages use `ready`, `peers`, `event`, `warning`, and `status`; renderer handles the messages needed for the demo.
