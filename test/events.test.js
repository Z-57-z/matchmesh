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
