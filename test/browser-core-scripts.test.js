const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')

test('core scripts can load sequentially in one browser global context', () => {
  const context = { window: {} }
  context.window = context
  vm.createContext(context)

  for (const file of ['events.js', 'room-state.js', 'room-key.js', 'launch-request.js']) {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', file), 'utf8')
    vm.runInContext(source, context, { filename: file })
  }

  assert.equal(typeof context.MatchMeshCore.createEventFactory, 'function')
  assert.equal(typeof context.MatchMeshCore.createRoomState, 'function')
  assert.equal(typeof context.MatchMeshCore.createRoomKey, 'function')
  assert.equal(typeof context.MatchMeshCore.normalizeRoomKey, 'function')
  assert.equal(typeof context.MatchMeshCore.resolveLaunchRequest, 'function')
})
