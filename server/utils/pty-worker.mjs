// PTY Worker — runs in a forked child process.
// If node-pty crashes (V8 HandleScope race), only this process dies.

import * as nodePty from 'node-pty'

const terminals = new Map()

process.on('message', (msg) => {
  const { type, id } = msg

  if (type === 'spawn') {
    try {
      const shells = [
        { cmd: 'zsh', args: ['-f'] },
        { cmd: 'bash', args: ['--noprofile', '--norc'] },
        { cmd: 'sh', args: [] },
      ]
      let pty = null
      for (const shell of shells) {
        try {
          pty = nodePty.spawn(shell.cmd, shell.args, {
            name: 'xterm-256color',
            cwd: msg.cwd || process.cwd(),
            env: msg.env || process.env,
            cols: msg.cols || 120,
            rows: msg.rows || 30,
          })
          break
        } catch {}
      }
      if (!pty) {
        process.send({ type: 'error', id, error: 'Failed to spawn shell' })
        return
      }

      terminals.set(id, pty)

      pty.onData((data) => {
        process.send({ type: 'data', id, data })
      })

      pty.onExit(({ exitCode }) => {
        terminals.delete(id)
        process.send({ type: 'exit', id, code: exitCode })
      })

      process.send({ type: 'spawned', id, pid: pty.pid })
    } catch (e) {
      process.send({ type: 'error', id, error: e.message })
    }
  }

  else if (type === 'write') {
    const pty = terminals.get(id)
    if (pty) {
      try { pty.write(msg.data) } catch {}
    }
  }

  else if (type === 'resize') {
    const pty = terminals.get(id)
    if (pty) {
      try { pty.resize(msg.cols, msg.rows) } catch {}
    }
  }

  else if (type === 'kill') {
    const pty = terminals.get(id)
    if (pty) {
      try {
        pty.write('\x03\n')
        pty.write('exit\n')
      } catch {}
      terminals.delete(id)
    }
  }
})

process.send({ type: 'ready' })
