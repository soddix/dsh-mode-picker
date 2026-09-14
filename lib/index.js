/**
 * dsh-mode-picker — host half.
 *
 * Behaviour lives in the client half, which reaches the host through the official
 * Remote API (`ctx.remote.agentPresets.list` / `.select`) rather than a
 * package-private RPC.
 *
 * This half exists for one additional reason: a diagnostic sink. Debugging a
 * browser-side plugin by asking a human to relay console output is a slow loop,
 * so the client POSTs what it observes to `/dsh-mode-picker/diag` and this half
 * appends it to `diag.log` next to the package. That file is readable straight
 * from the filesystem, which keeps the diagnosis loop on the machine.
 */

import { appendFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const name = 'dsh-mode-picker'

export const inject = ['webServer']

const DIAG_PATH = '/dsh-mode-picker/diag'
const DIAG_FILE = join(dirname(fileURLToPath(import.meta.url)), '..', 'diag.log')

/** Append one diagnostic line; the sink must never break the plugin or the response. */
function append(line) {
  try {
    appendFileSync(DIAG_FILE, line + '\n')
  } catch (error) {
    /* best effort by design */
  }
}

export function apply(ctx) {
  ctx.effect(() => {
    append('')
    append('=== host ready ' + new Date().toISOString() + ' ===')

    return ctx.webServer.register({
      kind: 'prefix',
      path: DIAG_PATH,
      handler: (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405
          res.end()
          return
        }
        let body = ''
        req.setEncoding('utf8')
        req.on('data', (chunk) => {
          if (body.length < 1000000) body += chunk
        })
        req.on('end', () => {
          append(new Date().toISOString() + ' ' + body)
          res.statusCode = 204
          res.end()
        })
        req.on('error', () => {
          try {
            res.statusCode = 400
            res.end()
          } catch (ignored) {
            /* the socket is already gone */
          }
        })
      },
    })
  })
}
