import assert from 'node:assert/strict'
import { execFile, spawn } from 'node:child_process'
import { once } from 'node:events'
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const manifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
const version = process.argv[2] ?? manifest.devDependencies['@deepseek-ai/dsh-tools']
assert.match(version, /^\d+\.\d+\.\d+(?:-[\w.-]+)?$/, 'Pass an explicit Harness version')
const work = await mkdtemp(join(tmpdir(), 'greet-compat-'))
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const env = {
  ...process.env,
  DSH_HOME: join(work, 'home'),
  DSH_TELEMETRY_DISABLED: '1',
  npm_config_registry: 'https://registry.npmjs.org',
}
const redact = text => text.replace(/token=[A-Za-z0-9_-]+/g, 'token=[REDACTED]')

async function run(command, args, cwd = work) {
  try {
    const result = await promisify(execFile)(command, args, {
      cwd, env, timeout: 240_000, maxBuffer: 8 * 1024 * 1024,
    })
    if (result.stderr) process.stderr.write(redact(result.stderr))
    return result.stdout
  } catch (error) {
    // Include command output so CI failures show the installation or boot cause.
    throw new Error(redact(`${command} ${args.join(' ')} failed\n${error.stdout ?? ''}\n${error.stderr ?? error.message}`))
  }
}

async function checkWeb(bin, patch) {
  const child = spawn(process.execPath, [bin, '--profile', 'web', '--patch', patch, '--no-open'], {
    cwd: work, env, stdio: ['ignore', 'pipe', 'pipe'],
  })
  const exited = once(child, 'exit')
  let logs = ''
  let resolveUrl
  let resolveTool
  const urlReady = new Promise(resolve => { resolveUrl = resolve })
  const toolReady = new Promise(resolve => { resolveTool = resolve })
  for (const stream of [child.stdout, child.stderr]) {
    const lines = createInterface({ input: stream })
    lines.on('line', line => {
      logs += `${redact(line)}\n`
      const match = /^dsh web: (http:\/\/\S+)/.exec(line)
      if (match) resolveUrl(match[1])
      if (line.startsWith('GREET_COMPAT_OK ')) resolveTool(line.slice('GREET_COMPAT_OK '.length))
    })
  }
  let timer
  try {
    await Promise.race([
      (async () => {
        const [address, toolsVersion] = await Promise.all([urlReady, toolReady])
        assert.equal(toolsVersion, version, 'The profile must use the selected host tool runtime')
        const url = new URL(address)
        const clean = new URL('/', url)
        const options = { signal: AbortSignal.timeout(10_000), redirect: 'manual' }
        assert.equal((await fetch(clean, options)).status, 401, 'An unauthenticated browser must be rejected')
        const exchange = await fetch(url, options)
        assert.equal(exchange.status, 303)
        const cookie = exchange.headers.get('set-cookie')?.split(';')[0]
        assert.ok(cookie, 'The launch URL must establish a browser session')
        const page = await fetch(clean, { ...options, headers: { cookie } })
        assert.equal(page.status, 200)
        assert.match(await page.text(), /<html/i)
      })(),
      exited.then(([code, signal]) => { throw new Error(`Web exited before checks completed (${code ?? signal})`) }),
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Web compatibility check timed out')), 60_000)
      }),
    ])
  } catch (error) {
    throw new Error(`${error.message}\n${logs}`, { cause: error })
  } finally {
    clearTimeout(timer)
    if (child.exitCode === null && child.signalCode === null) child.kill('SIGTERM')
    const killTimer = setTimeout(() => child.kill('SIGKILL'), 5_000)
    try { await exited } finally { clearTimeout(killTimer) }
  }
}

try {
  // Each release line may require a different (including prerelease) Cordis.
  const peers = JSON.parse(await run(npm, [
    'view', `@deepseek-ai/dsh-tools@${version}`, 'peerDependencies', '--json',
  ]))
  assert.equal(typeof peers['@deepseek-ai/cordis'], 'string')
  // The local lockfile stays untouched; each matrix cell owns its host installation.
  await writeFile(join(work, 'package.json'), JSON.stringify({
    private: true,
    type: 'module',
    dependencies: {
      '@deepseek-ai/dsh': version,
      '@deepseek-ai/dsh-tools': version,
      '@deepseek-ai/dsh-system-prompt': version,
      '@deepseek-ai/cordis': peers['@deepseek-ai/cordis'],
      '@deepseek-ai/schemastery': manifest.dependencies['@deepseek-ai/schemastery'],
    },
  }, null, 2))
  console.log(`Installing Harness ${version} in a temporary directory`)
  await run(npm, ['install', '--no-audit', '--no-fund', '--registry=https://registry.npmjs.org'])
  await cp(join(root, 'index.js'), join(work, 'index.js'))
  await cp(join(root, 'tests'), join(work, 'tests'), { recursive: true })
  process.stdout.write(await run(process.execPath, ['--test']))

  const packed = JSON.parse(await run(npm, ['pack', '--json', '--pack-destination', work], root))
  const bin = join(work, 'node_modules/@deepseek-ai/dsh/lib/bin.js')
  process.stdout.write(await run(process.execPath, [bin, 'plugin', '--profile', 'web', 'add', join(work, packed[0].filename)]))
  const config = await run(process.execPath, [bin, '--profile', 'web', '--dump-config'])
  assert.match(config, /id: greet-tool/)
  const profile = join(work, 'home/profiles/web')
  const installed = JSON.parse(await readFile(join(profile, 'node_modules/dsh-plugin-greet/package.json'), 'utf8'))
  assert.equal(installed.peerDependencies['@deepseek-ai/dsh-tools'], manifest.peerDependencies['@deepseek-ai/dsh-tools'])
  assert.equal(await readFile(join(profile, 'node_modules/dsh-plugin-greet/index.js'), 'utf8'), await readFile(join(root, 'index.js'), 'utf8'))
  const probe = join(profile, 'compat-probe.mjs')
  await cp(join(root, 'scripts/fixtures/web-probe.mjs'), probe)
  const patch = join(profile, 'compat.patch.json')
  await writeFile(patch, JSON.stringify([
    { id: 'webserver', config: { host: '127.0.0.1', port: 0 } },
    { insert: [{ id: 'greet-compat-probe', name: probe }] },
  ]))
  await checkWeb(bin, patch)
  console.log(`PASS Harness ${version}: unit tests, packed profile installation, four greetings, invalid arguments, Web login and HTML`)
} finally {
  await rm(work, { recursive: true, force: true })
}
