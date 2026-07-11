const { createEventFactory, createRoomState, createRoomKey, normalizeRoomKey } = window.MatchMeshCore

const reactions = ['Goal soon', 'Great save', 'Pressure rising', 'What a pass']

const elements = {
  launcher: document.querySelector('#launcher'),
  room: document.querySelector('#room'),
  form: document.querySelector('#room-form'),
  displayName: document.querySelector('#display-name'),
  matchName: document.querySelector('#match-name'),
  roomKey: document.querySelector('#room-key'),
  error: document.querySelector('#launcher-error'),
  roomTitle: document.querySelector('#room-title'),
  status: document.querySelector('#connection-status'),
  activeRoomKey: document.querySelector('#active-room-key'),
  peerCount: document.querySelector('#peer-count'),
  chatForm: document.querySelector('#chat-form'),
  chatInput: document.querySelector('#chat-input'),
  chatList: document.querySelector('#chat-list'),
  predictionForm: document.querySelector('#prediction-form'),
  predictionInput: document.querySelector('#prediction-input'),
  predictionList: document.querySelector('#prediction-list'),
  reactionButtons: document.querySelector('#reaction-buttons'),
  reactionList: document.querySelector('#reaction-list'),
  mvpForm: document.querySelector('#mvp-form'),
  mvpInput: document.querySelector('#mvp-input'),
  mvpList: document.querySelector('#mvp-list')
}

const roomState = createRoomState()
let eventFactory = null
let roomId = ''
let displayName = ''

for (const reaction of reactions) {
  const button = document.createElement('button')
  button.type = 'button'
  button.textContent = reaction
  button.addEventListener('click', () => sendRoomEvent('reaction.cast', { reaction }))
  elements.reactionButtons.append(button)
}

render()

elements.form.addEventListener('submit', async (event) => {
  event.preventDefault()
  clearLauncherError()

  const mode = event.submitter?.dataset.mode || 'create'
  const nextDisplayName = elements.displayName.value.trim()
  const matchName = elements.matchName.value.trim()

  if (!nextDisplayName) {
    elements.error.textContent = 'Display name is required.'
    return
  }

  let nextRoomId = ''
  try {
    nextRoomId = mode === 'join' ? normalizeRoomKey(elements.roomKey.value) : createRoomKey(matchName)
  } catch (error) {
    elements.error.textContent = error.message
    return
  }

  if (!nextRoomId) {
    elements.error.textContent = 'Room key is required to join.'
    return
  }

  try {
    setStatus('Starting room...')
    const started = await window.matchmesh.startRoom(nextRoomId)
    displayName = nextDisplayName
    roomId = started.roomKey || nextRoomId
    eventFactory = createEventFactory({ clientId: started.clientId })

    elements.roomTitle.textContent = matchName || roomId
    elements.activeRoomKey.textContent = roomId
    elements.launcher.classList.add('hidden')
    elements.room.classList.remove('hidden')
    setStatus('Room started. Waiting for fans to join.')
    render()

    if (mode === 'create') {
      sendRoomEvent('room.created', { matchName, displayName })
    }
  } catch (error) {
    setStatus('')
    elements.error.textContent = error.message
  }
})

elements.chatForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const text = elements.chatInput.value.trim()
  if (!text) return
  elements.chatInput.value = ''
  sendRoomEvent('chat.sent', { displayName, text })
})

elements.predictionForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const score = elements.predictionInput.value.trim()
  if (!score) return
  elements.predictionInput.value = ''
  sendRoomEvent('prediction.submitted', { displayName, score })
})

elements.mvpForm.addEventListener('submit', (event) => {
  event.preventDefault()
  const player = elements.mvpInput.value.trim()
  if (!player) return
  elements.mvpInput.value = ''
  sendRoomEvent('mvp.cast', { displayName, player })
})

window.matchmesh.onWorkerMessage((message) => {
  if (!message || typeof message !== 'object') return

  if (message.type === 'ready') {
    setStatus('P2P topic joined. Waiting for fans to join.')
    return
  }

  if (message.type === 'peers') {
    roomState.setPeerCount(message.count)
    const count = roomState.getSnapshot().peerCount
    setStatus(count > 0
      ? `${count} peer${count === 1 ? '' : 's'} connected.`
      : 'Waiting for fans to join.')
    render()
    return
  }

  if (message.type === 'event') {
    if (message.event && message.event.roomId === roomId) {
      roomState.addEvent(message.event)
      render()
    }
    return
  }

  if (message.type === 'warning') {
    setStatus(message.warning || 'Worker warning received.', 'warning')
    return
  }

  if (message.type === 'status' && message.status === 'closed') {
    setStatus('Room connection closed. Restart the room to reconnect.', 'closed')
  }
})

window.matchmesh.onWorkerError((message) => {
  setStatus(`Worker error: ${message}`, 'closed')
})

function sendRoomEvent(type, payload) {
  if (!eventFactory) return
  const roomEvent = eventFactory.create(type, roomId, payload)
  roomState.addEvent(roomEvent)
  render()
  window.matchmesh.sendEvent(roomEvent).catch((error) => {
    setStatus(error.message, 'warning')
  })
}

function render() {
  const snapshot = roomState.getSnapshot()
  elements.peerCount.textContent = `${snapshot.peerCount} peer${snapshot.peerCount === 1 ? '' : 's'}`

  elements.chatList.innerHTML = snapshot.chat.map((item) => `
    <div class="chat-item">
      <div class="meta">${escapeHtml(item.displayName || item.clientId)}</div>
      <div>${escapeHtml(item.text)}</div>
    </div>
  `).join('') || '<div class="stack-item">No chat yet.</div>'

  elements.predictionList.innerHTML = snapshot.predictions.map((item) => `
    <div class="stack-item">
      <div class="meta">${escapeHtml(item.displayName || item.clientId)}</div>
      <strong>${escapeHtml(item.score)}</strong>
    </div>
  `).join('') || '<div class="stack-item">No predictions yet.</div>'

  elements.reactionList.innerHTML = Object.entries(snapshot.reactions).map(([reaction, count]) => `
    <div class="stack-item">${escapeHtml(reaction)}: <strong>${count}</strong></div>
  `).join('') || '<div class="stack-item">No reactions yet.</div>'

  elements.mvpList.innerHTML = Object.entries(snapshot.mvpVotes).map(([player, count]) => `
    <div class="stack-item">${escapeHtml(player)}: <strong>${count}</strong></div>
  `).join('') || '<div class="stack-item">No MVP votes yet.</div>'

  elements.chatList.scrollTop = elements.chatList.scrollHeight
}

function setStatus(message, tone = '') {
  elements.status.textContent = message
  elements.status.classList.toggle('warning', tone === 'warning')
  elements.status.classList.toggle('closed', tone === 'closed')
}

function clearLauncherError() {
  elements.error.textContent = ''
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}
