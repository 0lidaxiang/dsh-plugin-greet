import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { Config, DEFAULT_CONFIG, apply } from '../index.js'

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

  it('registers a documented, closed argument schema', () => {
    const tool = registerTool()
    assert.equal(tool.name, 'greet')
    assert.deepEqual(tool.parameters.required, ['name'])
    assert.equal(tool.parameters.additionalProperties, false)
    assert.deepEqual(tool.parameters.properties.language.enum, ['en', 'zh'])
    assert.deepEqual(tool.parameters.properties.style.enum, ['friendly', 'formal'])
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
      [null, /arguments must be an object/],
      [{}, /name must be a string/],
      [{ name: 42 }, /name must be a string/],
      [{ name: '   ' }, /name must not be empty/],
      [{ name: 'a'.repeat(81) }, /at most 80 characters/],
      [{ name: 'Ada', language: 'fr' }, /language must be "en" or "zh"/],
      [{ name: 'Ada', style: 'loud' }, /style must be "friendly" or "formal"/],
      [{ name: 'Ada', extra: true }, /unsupported argument "extra"/],
    ]

    for (const [args, message] of cases) {
      await assert.rejects(() => tool.execute(args), message)
    }
  })
})
