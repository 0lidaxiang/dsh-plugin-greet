/** Exercise the installed subprocess provider with a real terminal and no model credentials. */
import assert from 'node:assert/strict'
import { Context } from '@deepseek-ai/cordis'
import LocalSubprocessRuntime from '@deepseek-ai/dsh-subprocess-local'

const context = new Context()
const fiber = await context.plugin(LocalSubprocessRuntime)
let terminal
let timer
try {
  terminal = await context.subprocess.spawnTerminal({
    argv: [process.execPath, '-e', `
      const assert = require('node:assert/strict')
      assert.equal(process.stdin.isTTY, true)
      assert.equal(process.stdout.isTTY, true)
      assert.equal(process.stdout.columns, 80)
      assert.equal(process.stdout.rows, 24)
      const reader = require('node:readline').createInterface({ input: process.stdin })
      reader.once('line', line => {
        process.stdout.write('DSH_PTY_REPLY:' + line.toUpperCase() + '\\n', () => process.exit(0))
      })
    `],
    cwd: process.cwd(),
    rows: 24,
    cols: 80,
    graceMs: 1000,
  })
  const handle = terminal
  const exchange = async () => {
    let output = ''
    const drain = (async () => {
      for await (const chunk of handle.output) output += chunk.toString('utf8')
    })()
    await handle.write('npm12-terminal-input\n')
    const outcome = await handle.done
    await drain
    assert.equal(outcome.exitCode, 0, output)
    assert.ok(output.includes('DSH_PTY_REPLY:NPM12-TERMINAL-INPUT'), output)
  }
  await Promise.race([
    exchange(),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('installed PTY input/output timed out')), 15_000)
    }),
  ])
  console.log('installed PTY: allocation, dimensions, input, output, and clean exit passed')
} finally {
  clearTimeout(timer)
  await terminal?.terminate()
  await fiber.dispose()
}
