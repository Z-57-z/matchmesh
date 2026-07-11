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
