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
