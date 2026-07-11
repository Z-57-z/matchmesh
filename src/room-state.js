function createRoomState() {
  const eventIds = new Set()
  const events = []
  let peerCount = 0

  function addEvent(event) {
    if (!event || !event.id || eventIds.has(event.id)) return false
    eventIds.add(event.id)
    events.push(cloneEvent(event))
    events.sort(compareEvents)
    return true
  }

  function setPeerCount(count) {
    peerCount = Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0
  }

  function getSnapshot() {
    const chat = []
    const predictionsByClient = new Map()
    const reactions = {}
    const mvpVotes = {}

    for (const event of events) {
      const payload = event.payload
      const hasValidMetadata = hasStringFields(event, ['id', 'clientId', 'createdAt'])

      if (event.type === 'chat.sent' && hasValidMetadata && hasPayloadFields(payload, ['displayName', 'text'])) {
        chat.push({
          id: event.id,
          clientId: event.clientId,
          displayName: payload.displayName,
          text: payload.text,
          createdAt: event.createdAt
        })
      }

      if (event.type === 'prediction.submitted' && hasValidMetadata && hasPayloadFields(payload, ['displayName', 'score'])) {
        predictionsByClient.set(event.clientId, {
          clientId: event.clientId,
          displayName: payload.displayName,
          score: payload.score
        })
      }

      if (event.type === 'reaction.cast' && hasValidMetadata && hasPayloadFields(payload, ['reaction'])) {
        reactions[payload.reaction] = (reactions[payload.reaction] || 0) + 1
      }

      if (event.type === 'mvp.cast' && hasValidMetadata && hasPayloadFields(payload, ['player'])) {
        mvpVotes[payload.player] = (mvpVotes[payload.player] || 0) + 1
      }
    }

    return {
      peerCount,
      chat,
      predictions: Array.from(predictionsByClient.values()),
      reactions,
      mvpVotes,
      events: events.map(cloneEvent)
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

function cloneEvent(event) {
  if (typeof structuredClone === 'function') return structuredClone(event)
  return JSON.parse(JSON.stringify(event))
}

function hasPayloadFields(payload, fields) {
  if (!payload || typeof payload !== 'object') return false
  return hasStringFields(payload, fields)
}

function hasStringFields(value, fields) {
  if (!value || typeof value !== 'object') return false
  return fields.every((field) => typeof value[field] === 'string' && value[field].trim() !== '')
}

const api = {
  createRoomState
}

if (typeof module !== 'undefined') module.exports = api
if (typeof window !== 'undefined') {
  window.MatchMeshCore = Object.assign(window.MatchMeshCore || {}, api)
}
