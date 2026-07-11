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
