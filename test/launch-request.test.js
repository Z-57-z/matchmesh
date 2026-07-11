const test = require('node:test')
const assert = require('node:assert/strict')
const { resolveLaunchRequest } = require('../src/launch-request')

test('join uses the typed room key instead of the default match name', () => {
  const request = resolveLaunchRequest({
    requestedMode: 'join',
    displayName: 'Bob',
    matchName: 'Brazil vs Spain',
    roomKey: 'Argentina vs France'
  })

  assert.equal(request.mode, 'join')
  assert.equal(request.roomId, 'argentina-vs-france')
  assert.equal(request.roomTitle, 'argentina-vs-france')
})

test('submit without an explicit button joins when room key has content', () => {
  const request = resolveLaunchRequest({
    requestedMode: undefined,
    displayName: 'Bob',
    matchName: 'Brazil vs Spain',
    roomKey: 'Japan vs Germany'
  })

  assert.equal(request.mode, 'join')
  assert.equal(request.roomId, 'japan-vs-germany')
})

test('create uses match name when no room key is provided', () => {
  const request = resolveLaunchRequest({
    requestedMode: undefined,
    displayName: 'Alice',
    matchName: 'Brazil vs Spain',
    roomKey: ''
  })

  assert.equal(request.mode, 'create')
  assert.equal(request.roomId, 'brazil-vs-spain')
  assert.equal(request.roomTitle, 'Brazil vs Spain')
})

test('join requires a room key', () => {
  assert.throws(() => resolveLaunchRequest({
    requestedMode: 'join',
    displayName: 'Bob',
    matchName: 'Brazil vs Spain',
    roomKey: ''
  }), /Room key is required to join/)
})
