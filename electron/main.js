const { app, BrowserWindow, ipcMain } = require('electron')
const path = require('node:path')
const crypto = require('node:crypto')
const PearRuntime = require('pear-runtime')
const { topicFromRoomKey } = require('../src/room-key')

let windowRef = null
let worker = null
let activeRoomKey = null

function createWindow() {
  windowRef = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 640,
    title: 'MatchMesh',
    backgroundColor: '#f5f3ee',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false
    }
  })

  windowRef.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

function startWorker(roomKey) {
  if (worker) worker.destroy()

  activeRoomKey = roomKey
  const workerPath = path.join(__dirname, '..', 'workers', 'main.mjs')
  const topic = topicFromRoomKey(roomKey)
  const clientId = crypto.randomBytes(4).toString('hex')

  const currentWorker = PearRuntime.run(workerPath, [topic, clientId])
  worker = currentWorker

  currentWorker.on('data', (data) => {
    if (worker !== currentWorker) return
    if (!windowRef || windowRef.isDestroyed()) return
    windowRef.webContents.send('matchmesh:worker-message', data.toString())
  })

  currentWorker.stderr.on('data', (data) => {
    if (worker !== currentWorker) return
    if (!windowRef || windowRef.isDestroyed()) return
    windowRef.webContents.send('matchmesh:worker-error', data.toString())
  })

  currentWorker.once('error', (error) => {
    if (worker !== currentWorker) return
    worker = null
    if (!windowRef || windowRef.isDestroyed()) return
    windowRef.webContents.send('matchmesh:worker-error', error.message)
  })

  currentWorker.once('close', () => {
    if (worker !== currentWorker) return
    worker = null
    if (!windowRef || windowRef.isDestroyed()) return
    windowRef.webContents.send('matchmesh:worker-message', JSON.stringify({ type: 'status', status: 'closed' }))
  })

  return { clientId, roomKey: activeRoomKey }
}

ipcMain.handle('matchmesh:start-room', (_event, roomKey) => {
  return startWorker(roomKey)
})

ipcMain.handle('matchmesh:send-event', (_event, roomEvent) => {
  if (!worker) throw new Error('Room worker is not running')
  worker.write(Buffer.from(JSON.stringify({ type: 'event', event: roomEvent })))
  return true
})

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (worker) worker.destroy()
  app.quit()
})
