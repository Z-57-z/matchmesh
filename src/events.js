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
