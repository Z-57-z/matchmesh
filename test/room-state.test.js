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
