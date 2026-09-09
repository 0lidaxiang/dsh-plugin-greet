import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

export const inject = ['tools']

// Wait for the assembled profile without blocking plugin activation.
export function apply(ctx) {
  void ctx.loader.await().then(async () => {
    const require = createRequire(import.meta.url)
    assert.ok(ctx.tools.schemas().some(tool => tool.name === 'greet'))
    for (const [index, [args, expected]] of [
      [{ name: 'Ada' }, 'Hello, Ada!'],
      [{ name: 'Ada', style: 'formal' }, 'Greetings, Ada.'],
      [{ name: '小明', language: 'zh' }, '你好，小明！'],
      [{ name: '小明', language: 'zh', style: 'formal' }, '您好，小明。'],
    ].entries()) {
      const result = await ctx.tools.execute({
        signal: new AbortController().signal,
        callId: `compat-${index}`,
        name: 'greet',
        arguments: args,
      })
      assert.equal(result.isError, false)
      assert.equal(result.value.message, expected)
      assert.deepEqual(result.content, [{ type: 'text', text: expected }])
    }
    const invalid = await ctx.tools.execute({
      signal: new AbortController().signal,
      callId: 'compat-invalid',
      name: 'greet',
      arguments: { name: 42 },
    })
    assert.equal(invalid.isError, true)
    assert.deepEqual(invalid.error.info, { name: 'ToolArgsError', code: 'INVALID_ARGS' })
    console.log(`GREET_COMPAT_OK ${require('@deepseek-ai/dsh-tools/package.json').version}`)
  }).catch(error => {
    console.error('GREET_COMPAT_FAILED', error)
    process.exitCode = 1
    void ctx.stop()
  })
}
