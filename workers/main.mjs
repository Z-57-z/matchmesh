import Hyperswarm from 'hyperswarm'
import b4a from 'b4a'

const topic = b4a.from(Bare.argv[2], 'hex')
const clientId = Bare.argv[3]
const swarm = new Hyperswarm()
const conns = new Set()

function sendToMain(message) {
  Bare.IPC.write(JSON.stringify(message))
}

function broadcast(message) {
  const data = JSON.stringify(message)
  for (const conn of conns) {
    conn.write(data)
  }
}

swarm.on('connection', (conn) => {
  conns.add(conn)
  sendToMain({ type: 'peers', count: conns.size })

  conn.on('data', (data) => {
    try {
      const message = JSON.parse(b4a.toString(data))
      sendToMain(message)
    } catch {
      sendToMain({ type: 'warning', warning: 'Ignored malformed peer message' })
    }
  })

  conn.on('error', () => {})

  conn.once('close', () => {
    conns.delete(conn)
    sendToMain({ type: 'peers', count: conns.size })
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
