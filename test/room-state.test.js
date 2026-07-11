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

test('room state snapshots are isolated from external event mutations', () => {
  const room = createRoomState()
  const chat = event('alice:1', 'chat.sent', 'alice', { displayName: 'Alice', text: 'hello' })

  room.addEvent(chat)
  chat.payload.text = 'mutated outside'

  const snapshot = room.getSnapshot()
  assert.equal(snapshot.chat[0].text, 'hello')
  assert.equal(snapshot.events[0].payload.text, 'hello')

  snapshot.events[0].payload.text = 'mutated snapshot'
  assert.equal(room.getSnapshot().events[0].payload.text, 'hello')
})

test('room state skips malformed known events without throwing', () => {
  const room = createRoomState()
  room.addEvent(event('alice:1', 'chat.sent', 'alice'))
  room.addEvent(event('alice:2', 'chat.sent', 'alice', { displayName: 'Alice' }))
  room.addEvent(event('alice:3', 'prediction.submitted', 'alice', { displayName: 'Alice' }))
  room.addEvent(event('alice:4', 'reaction.cast', 'alice', {}))
  room.addEvent(event('alice:5', 'mvp.cast', 'alice', {}))

  assert.doesNotThrow(() => room.getSnapshot())
  assert.deepEqual(room.getSnapshot().chat, [])
  assert.deepEqual(room.getSnapshot().predictions, [])
  assert.deepEqual(room.getSnapshot().reactions, {})
  assert.deepEqual(room.getSnapshot().mvpVotes, {})
})

test('room state skips known events with non-string payload fields', () => {
  const room = createRoomState()
  room.addEvent(event('alice:1', 'chat.sent', 'alice', { displayName: 'Alice', text: { body: 'hello' } }))
  room.addEvent(event('alice:2', 'prediction.submitted', 'alice', { displayName: 'Alice', score: { home: 1, away: 1 } }))
  room.addEvent(event('alice:3', 'reaction.cast', 'alice', { reaction: { label: 'Goal soon' } }))
  room.addEvent(event('alice:4', 'mvp.cast', 'alice', { player: { name: 'Marta' } }))
  room.addEvent(event('alice:5', 'chat.sent', 'alice', { displayName: '', text: 'empty name' }))
  room.addEvent(event('alice:6', 'prediction.submitted', 'alice', { displayName: 'Alice', score: '' }))

  const snapshot = room.getSnapshot()

  assert.deepEqual(snapshot.chat, [])
  assert.deepEqual(snapshot.predictions, [])
  assert.deepEqual(snapshot.reactions, {})
  assert.deepEqual(snapshot.mvpVotes, {})
})

test('room state derived snapshots cannot mutate internal event payload objects', () => {
  const room = createRoomState()
  room.addEvent(event('alice:1', 'chat.sent', 'alice', { displayName: 'Alice', text: { body: 'hello' } }))

  const snapshot = room.getSnapshot()
  assert.deepEqual(snapshot.chat, [])

  snapshot.events[0].payload.text.body = 'mutated through snapshot'

  assert.equal(room.getSnapshot().events[0].payload.text.body, 'hello')
})

test('room state skips known events with non-string metadata fields', () => {
  const room = createRoomState()
  room.addEvent(event({ value: 'alice:1' }, 'chat.sent', 'alice', { displayName: 'Alice', text: 'object id' }))
  room.addEvent(event('alice:2', 'chat.sent', { value: 'alice' }, { displayName: 'Alice', text: 'object client' }))
  room.addEvent(event('alice:3', 'chat.sent', 'alice', { displayName: 'Alice', text: 'object time' }, { value: 'now' }))
  room.addEvent(event('alice:4', 'chat.sent', 'alice', { displayName: 'Alice', text: 'empty time' }, ''))

  const snapshot = room.getSnapshot()

  assert.deepEqual(snapshot.chat, [])
  assert.equal(snapshot.events.length, 3)

  const eventWithObjectClient = snapshot.events.find((item) => item.clientId && item.clientId.value === 'alice')
  const eventWithObjectCreatedAt = snapshot.events.find((item) => item.createdAt && item.createdAt.value === 'now')
  eventWithObjectClient.clientId.value = 'mutated through snapshot'
  eventWithObjectCreatedAt.createdAt.value = 'mutated through snapshot'

  const nextSnapshot = room.getSnapshot()
  assert.equal(nextSnapshot.events.find((item) => item.clientId && item.clientId.value === 'alice').clientId.value, 'alice')
  assert.equal(nextSnapshot.events.find((item) => item.createdAt && item.createdAt.value === 'now').createdAt.value, 'now')
})

test('room state rejects events with non-string ids before storing them', () => {
  const room = createRoomState()
  const objectId = { value: 'alice:1' }

  assert.equal(room.addEvent(event(objectId, 'chat.sent', 'alice', { displayName: 'Alice', text: 'object id' })), false)
  assert.deepEqual(room.getSnapshot().events, [])

  objectId.value = 'mutated outside'

  assert.equal(room.addEvent(event('alice:1', 'chat.sent', 'alice', { displayName: 'Alice', text: 'hello' })), true)
  assert.deepEqual(room.getSnapshot().chat.map((item) => item.text), ['hello'])
  assert.deepEqual(room.getSnapshot().events.map((item) => item.id), ['alice:1'])
})

test('room state does not throw when known event payload contains functions', () => {
  const room = createRoomState()
  const badEvent = event('alice:1', 'chat.sent', 'alice', {
    displayName: 'Alice',
    text: () => 'hello'
  })

  assert.doesNotThrow(() => room.addEvent(badEvent))
  assert.deepEqual(room.getSnapshot().chat, [])
})

test('room state does not derive fields coerced by toJSON', () => {
  const room = createRoomState()
  room.addEvent(event('alice:1', 'chat.sent', { toJSON: () => 'alice' }, { displayName: 'Alice', text: 'client toJSON' }))
  room.addEvent(event('alice:2', 'chat.sent', 'alice', { displayName: 'Alice', text: 'time toJSON' }, { toJSON: () => '2026-07-12T00:00:00.000Z' }))
  room.addEvent(event('alice:3', 'chat.sent', 'alice', { displayName: 'Alice', text: { toJSON: () => 'hello' } }))
  room.addEvent(event('alice:4', 'prediction.submitted', 'alice', { displayName: 'Alice', score: { toJSON: () => '2-1' } }))
  room.addEvent(event('alice:5', 'reaction.cast', 'alice', { reaction: { toJSON: () => 'Goal soon' } }))
  room.addEvent(event('alice:6', 'mvp.cast', 'alice', { player: { toJSON: () => 'Marta' } }))

  const snapshot = room.getSnapshot()

  assert.deepEqual(snapshot.chat, [])
  assert.deepEqual(snapshot.predictions, [])
  assert.deepEqual(snapshot.reactions, {})
  assert.deepEqual(snapshot.mvpVotes, {})
})

test('room state normalizes peer count to a non-negative integer', () => {
  const room = createRoomState()

  room.setPeerCount(-1)
  assert.equal(room.getSnapshot().peerCount, 0)

  room.setPeerCount(2.9)
  assert.equal(room.getSnapshot().peerCount, 2)

  room.setPeerCount(Infinity)
  assert.equal(room.getSnapshot().peerCount, 0)

  room.setPeerCount(NaN)
  assert.equal(room.getSnapshot().peerCount, 0)
})
