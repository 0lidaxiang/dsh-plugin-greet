import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { Context } from '@deepseek-ai/cordis'
import ToolRuntime, { ToolArgsError } from '@deepseek-ai/dsh-tools'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'

import * as GreetPlugin from '../index.js'

const { Config, DEFAULT_CONFIG, apply } = GreetPlugin

function registerTool(config) {
  let tool
  apply({
    tools: {
      register(definition) {
        tool = definition
      },
    },
  }, config)
  assert.ok(tool, 'the greet tool should be registered')
  return tool
}

describe('greet plugin', () => {
  it('fills plugin configuration defaults through the exported schema', () => {
    const result = Config['~standard'].validate({})
    assert.deepEqual(result, { value: DEFAULT_CONFIG })
  })

  it('registers a typed schema through the current defineTool API', () => {
    const tool = registerTool()
    assert.equal(tool.name, 'greet')
    assert.deepEqual(tool.parameters.required, ['name'])
    assert.equal(tool.parameters.additionalProperties, undefined)
    assert.deepEqual(tool.parameters.properties.language.enum, ['en', 'zh'])
    assert.deepEqual(tool.parameters.properties.style.enum, ['friendly', 'formal'])
    assert.deepEqual(tool.output.schema.required, ['message', 'name', 'language', 'style'])
    assert.equal(tool.output.schema.additionalProperties, false)
  })

  it('returns structured friendly English output by default', async () => {
    const tool = registerTool()
    assert.deepEqual(await tool.execute({ name: 'Ada' }), {
      message: 'Hello, Ada!',
      name: 'Ada',
      language: 'en',
      style: 'friendly',
    })
  })

  it('uses plugin configuration when optional arguments are omitted', async () => {
    const tool = registerTool({
      greeting: 'Hi',
      punctuation: '?',
      defaultLanguage: 'en',
      defaultStyle: 'friendly',
    })
    assert.equal((await tool.execute({ name: 'Grace' })).message, 'Hi, Grace?')
  })

  it('supports Chinese and formal greetings and trims the name', async () => {
    const tool = registerTool()
    assert.deepEqual(await tool.execute({ name: ' 小明 ', language: 'zh', style: 'formal' }), {
      message: '您好，小明。',
      name: '小明',
      language: 'zh',
      style: 'formal',
    })
    assert.equal((await tool.execute({ name: 'Ada', style: 'formal' })).message, 'Greetings, Ada.')
  })

  it('renders only the human-readable message for the model', async () => {
    const tool = registerTool()
    const value = await tool.execute({ name: 'Ada' })
    assert.deepEqual(tool.output.render({}, value), [{ type: 'text', text: 'Hello, Ada!' }])
  })

  it('rejects invalid plugin configuration before registration', () => {
    assert.throws(() => registerTool({ greeting: '   ' }), /greeting must be a non-empty string/)
    assert.throws(() => registerTool({ punctuation: '....' }), /punctuation must be at most 3 characters/)
    assert.throws(() => registerTool({ defaultLanguage: 'fr' }), /defaultLanguage must be "en" or "zh"/)
    assert.throws(() => registerTool({ defaultStyle: 'loud' }), /defaultStyle must be "friendly" or "formal"/)
  })

  it('rejects invalid arguments with actionable errors', async () => {
    const tool = registerTool()
    const cases = [
      [null, /invalid arguments: .* must be an object/],
      [{}, /missing required property .*name/],
      [{ name: 42 }, /.*name.* must be a string/],
      [{ name: '   ' }, /name must not be empty/],
      [{ name: 'a'.repeat(81) }, /at most 80 characters/],
      [{ name: 'Ada', language: 'fr' }, /.*language.* must be one of/],
      [{ name: 'Ada', style: 'loud' }, /.*style.* must be one of/],
      [{ name: 'Ada', extra: true }, /unsupported argument "extra"/],
    ]

    for (const [args, message] of cases) {
      await assert.rejects(() => tool.execute(args), message)
    }
  })

  it('uses Harness ToolArgsError for schema violations', async () => {
    const tool = registerTool()
    await assert.rejects(() => tool.execute({ name: 42 }), ToolArgsError)
  })

  it('registers and executes through the real Harness tool runtime', async () => {
    const ctx = new Context()
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(GreetPlugin)

    const schema = ctx.tools.schemas().find(tool => tool.name === 'greet')
    assert.deepEqual(schema.parameters.required, ['name'])

    const signal = new AbortController().signal
    const result = await ctx.tools.execute({
      signal,
      callId: 'greet-test-1',
      name: 'greet',
      arguments: { name: 'Ada', language: 'en', style: 'friendly' },
    })
    assert.deepEqual(result, {
      isError: false,
      content: [{ type: 'text', text: 'Hello, Ada!' }],
      value: {
        message: 'Hello, Ada!',
        name: 'Ada',
        language: 'en',
        style: 'friendly',
      },
    })

    const invalid = await ctx.tools.execute({
      signal,
      callId: 'greet-test-2',
      name: 'greet',
      arguments: { name: 42 },
    })
    assert.equal(invalid.isError, true)
    assert.deepEqual(invalid.error.info, {
      name: 'ToolArgsError',
      code: 'INVALID_ARGS',
    })
  })
})
