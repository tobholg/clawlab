import type { Peer } from 'crossws'
import { getPtySession, resizePty, writeToPty } from '../utils/ptyManager'

interface Disposable {
  dispose: () => void
}

interface PeerState {
  authed: boolean
  terminalId: string | null
  outputListener: Disposable | null
  exitListener: Disposable | null
}

const peers = new Map<Peer, PeerState>()

function detachPeer(state: PeerState) {
  state.outputListener?.dispose()
  state.exitListener?.dispose()
  state.outputListener = null
  state.exitListener = null
  state.terminalId = null
}

export default defineWebSocketHandler({
  open(peer) {
    peers.set(peer, {
      authed: false,
      terminalId: null,
      outputListener: null,
      exitListener: null,
    })
  },

  close(peer) {
    const state = peers.get(peer)
    if (!state) return

    detachPeer(state)
    peers.delete(peer)
  },

  message(peer, message) {
    const state = peers.get(peer)
    if (!state) return

    let parsed: any
    try {
      parsed = JSON.parse(message.text())
    } catch {
      return
    }

    if (parsed?.type === 'auth') {
      state.authed = true
      peer.send(JSON.stringify({ type: 'auth', success: true }))
      return
    }

    if (!state.authed) {
      return
    }

    if (parsed?.type === 'attach') {
      const terminalId = typeof parsed.terminalId === 'string' ? parsed.terminalId.trim() : ''
      if (!terminalId) return

      const session = getPtySession(terminalId)
      if (!session) {
        peer.send(JSON.stringify({ type: 'exit', code: -1 }))
        return
      }

      detachPeer(state)
      state.terminalId = terminalId

      const lines = session.pendingLine
        ? [...session.buffer, session.pendingLine]
        : [...session.buffer]

      peer.send(JSON.stringify({
        type: 'buffer',
        lines,
      }))

      // Listen for data from the PTY worker
      const onData = (data: string) => {
        peer.send(JSON.stringify({
          type: 'output',
          data,
        }))
      }
      session.dataListeners.add(onData)
      state.outputListener = { dispose: () => {
        session.dataListeners.delete(onData)
      }}

      const onExit = (code: number) => {
        peer.send(JSON.stringify({ type: 'exit', code }))
        detachPeer(state)
      }
      session.exitListeners.add(onExit)
      state.exitListener = { dispose: () => {
        session.exitListeners.delete(onExit)
      }}
      return
    }

    if (parsed?.type === 'input') {
      if (!state.terminalId) return
      if (typeof parsed.data !== 'string') return

      writeToPty(state.terminalId, parsed.data)
      return
    }

    if (parsed?.type === 'resize') {
      if (!state.terminalId) return

      const cols = Number(parsed.cols)
      const rows = Number(parsed.rows)

      if (!Number.isFinite(cols) || !Number.isFinite(rows)) return
      if (cols <= 0 || rows <= 0) return

      resizePty(state.terminalId, Math.floor(cols), Math.floor(rows))
    }
  },
})
