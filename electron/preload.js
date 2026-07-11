const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('matchmesh', {
  startRoom(roomKey) {
    return ipcRenderer.invoke('matchmesh:start-room', roomKey)
  },
  sendEvent(roomEvent) {
    return ipcRenderer.invoke('matchmesh:send-event', roomEvent)
  },
  onWorkerMessage(listener) {
    const wrapped = (_event, payload) => listener(JSON.parse(payload))
    ipcRenderer.on('matchmesh:worker-message', wrapped)
    return () => ipcRenderer.removeListener('matchmesh:worker-message', wrapped)
  },
  onWorkerError(listener) {
    const wrapped = (_event, payload) => listener(payload)
    ipcRenderer.on('matchmesh:worker-error', wrapped)
    return () => ipcRenderer.removeListener('matchmesh:worker-error', wrapped)
  }
})
