function createRoomState() {
  const eventIds = new Set()
  const events = []
  let peerCount = 0

  function addEvent(event) {
    if (!event || !isNonEmptyString(event.id) || eventIds.has(event.id)) return false
    const clonedEvent = cloneEvent(event)
    if (!clonedEvent) return false
    eventIds.add(event.id)
    events.push(clonedEvent)
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
  try {
    return cloneJsonValue(event, new WeakSet())
  } catch {
    return null
  }
}

function cloneJsonValue(value, seen) {
  if (value === null) return null

  const type = typeof value
  if (type === 'string' || type === 'boolean') return value
  if (type === 'number') return Number.isFinite(value) ? value : null
  if (type === 'function' || type === 'undefined' || type === 'symbol') return undefined
  if (type === 'bigint') throw new Error('Cannot clone bigint')

  if (seen.has(value)) throw new Error('Cannot clone circular structure')
  seen.add(value)

  if (Array.isArray(value)) {
    const output = value.map((item) => {
      const clonedItem = cloneJsonValue(item, seen)
      return clonedItem === undefined ? null : clonedItem
    })
    seen.delete(value)
    return output
  }

  const output = {}
  for (const key of Object.keys(value)) {
    const clonedValue = cloneJsonValue(value[key], seen)
    if (clonedValue !== undefined) output[key] = clonedValue
  }
  seen.delete(value)
  return output
}

function hasPayloadFields(payload, fields) {
  if (!payload || typeof payload !== 'object') return false
  return hasStringFields(payload, fields)
}

function hasStringFields(value, fields) {
  if (!value || typeof value !== 'object') return false
  return fields.every((field) => isNonEmptyString(value[field]))
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim() !== ''
}

const api = {
  createRoomState
}

if (typeof module !== 'undefined') module.exports = api
if (typeof window !== 'undefined') {
  window.MatchMeshCore = Object.assign(window.MatchMeshCore || {}, api)
}
