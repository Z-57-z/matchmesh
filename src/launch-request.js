(function () {
let createRoomKeyRef
let normalizeRoomKeyRef

if (typeof module !== 'undefined') {
  const roomKeyApi = require('./room-key')
  createRoomKeyRef = roomKeyApi.createRoomKey
  normalizeRoomKeyRef = roomKeyApi.normalizeRoomKey
} else if (typeof window !== 'undefined' && window.MatchMeshCore) {
  createRoomKeyRef = window.MatchMeshCore.createRoomKey
  normalizeRoomKeyRef = window.MatchMeshCore.normalizeRoomKey
}

function resolveLaunchRequest({ requestedMode, displayName, matchName, roomKey }) {
  const nextDisplayName = String(displayName || '').trim()
  const nextMatchName = String(matchName || '').trim()
  const nextRoomKey = String(roomKey || '').trim()
  const mode = requestedMode === 'join' || requestedMode === 'create'
    ? requestedMode
    : (nextRoomKey ? 'join' : 'create')

  if (!nextDisplayName) {
    throw new Error('Display name is required.')
  }

  if (mode === 'join') {
    const roomId = normalizeRoomKeyRef(nextRoomKey)
    if (!roomId) throw new Error('Room key is required to join.')
    return {
      mode,
      displayName: nextDisplayName,
      matchName: nextMatchName,
      roomId,
      roomTitle: roomId
    }
  }

  const roomId = nextRoomKey ? normalizeRoomKeyRef(nextRoomKey) : createRoomKeyRef(nextMatchName)
  if (!roomId) throw new Error('Room key is required.')
  return {
    mode,
    displayName: nextDisplayName,
    matchName: nextMatchName,
    roomId,
    roomTitle: nextMatchName || roomId
  }
}

const api = {
  resolveLaunchRequest
}

if (typeof module !== 'undefined') {
  module.exports = api
}
if (typeof window !== 'undefined') {
  window.MatchMeshCore = Object.assign(window.MatchMeshCore || {}, api)
}
})()
