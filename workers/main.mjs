import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'

const topic = b4a.from(Bare.argv[2], 'hex')
const clientId = Bare.argv[3]
const swarm = new Hyperswarm()
const conns = new Set()
const buffers = new Map()

function sendToMain(message) {
  Bare.IPC.write(JSON.stringify(message))
}

function sendPeerCount() {
  sendToMain({ type: 'peers', count: conns.size })
}

function removeConn(conn) {
  if (!conns.delete(conn)) return
  buffers.delete(conn)
  sendPeerCount()
}

function broadcast(message) {
  const data = `${JSON.stringify(message)}\n`
  for (const conn of conns) {
    try {
      conn.write(data)
    } catch {
      removeConn(conn)
    }
  }
}

swarm.on('connection', (conn) => {
  conns.add(conn)
  buffers.set(conn, '')
  sendPeerCount()

  conn.on('data', (data) => {
    const nextBuffer = `${buffers.get(conn) || ''}${b4a.toString(data)}`
    const frames = nextBuffer.split('\n')
    buffers.set(conn, frames.pop() || '')

    for (const frame of frames) {
      if (!frame) continue
      try {
        const message = JSON.parse(frame)
        sendToMain(message)
      } catch {
        sendToMain({ type: 'warning', warning: 'Ignored malformed peer message' })
      }
    }
  })

  conn.on('error', () => {
    removeConn(conn)
  })

  conn.once('close', () => {
    removeConn(conn)
  })
})

Bare.IPC.on('data', (data) => {
  try {
    const message = JSON.parse(b4a.toString(data))
    if (message.type === 'event') {
      broadcast({ type: 'event', event: message.event })
    }
  } catch {
    sendToMain({ type: 'warning', warning: 'Ignored malformed local message' })
  }
})

await swarm.join(topic, { client: true, server: true }).flushed()
sendToMain({ type: 'ready', clientId })
