import Schema from '@deepseek-ai/schemastery'
import { defineTool } from '@deepseek-ai/dsh-tools'

export const name = 'greet-tool'
export const inject = ['tools']

export const DEFAULT_CONFIG = Object.freeze({
  greeting: 'Hello',
  punctuation: '!',
  defaultLanguage: 'en',
  defaultStyle: 'friendly',
})

export const Config = Schema.object({
  greeting: Schema.string()
    .pattern(/\S/)
    .min(1)
    .max(32)
    .default(DEFAULT_CONFIG.greeting)
    .description('Greeting used for friendly English output.'),
  punctuation: Schema.string()
    .max(3)
    .default(DEFAULT_CONFIG.punctuation)
    .description('Punctuation used for friendly English output.'),
  defaultLanguage: Schema.union(['en', 'zh'])
    .default(DEFAULT_CONFIG.defaultLanguage)
    .description('Language used when the tool call omits language.'),
  defaultStyle: Schema.union(['friendly', 'formal'])
    .default(DEFAULT_CONFIG.defaultStyle)
    .description('Style used when the tool call omits style.'),
})

const LANGUAGES = new Set(['en', 'zh'])
const STYLES = new Set(['friendly', 'formal'])
const ARGUMENT_KEYS = new Set(['name', 'language', 'style'])
const MAX_NAME_LENGTH = 80

function resolveConfig(config = {}) {
  const resolved = { ...DEFAULT_CONFIG, ...config }

  if (typeof resolved.greeting !== 'string' || !resolved.greeting.trim()) {
    throw new TypeError('greet config: greeting must be a non-empty string')
  }
  if (resolved.greeting.length > 32) {
    throw new RangeError('greet config: greeting must be at most 32 characters')
  }
  if (typeof resolved.punctuation !== 'string') {
    throw new TypeError('greet config: punctuation must be a string')
  }
  if (resolved.punctuation.length > 3) {
    throw new RangeError('greet config: punctuation must be at most 3 characters')
  }
  if (!LANGUAGES.has(resolved.defaultLanguage)) {
    throw new TypeError('greet config: defaultLanguage must be "en" or "zh"')
  }
  if (!STYLES.has(resolved.defaultStyle)) {
    throw new TypeError('greet config: defaultStyle must be "friendly" or "formal"')
  }

  return {
    ...resolved,
    greeting: resolved.greeting.trim(),
  }
}

function resolveArguments(args, config) {
  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new TypeError('greet: arguments must be an object')
  }

  for (const key of Object.keys(args)) {
    if (!ARGUMENT_KEYS.has(key)) {
      throw new TypeError(`greet: unsupported argument "${key}"`)
    }
  }

  if (typeof args.name !== 'string') {
    throw new TypeError('greet: name must be a string')
  }

  const normalizedName = args.name.trim()
  if (!normalizedName) {
    throw new RangeError('greet: name must not be empty')
  }
  if (normalizedName.length > MAX_NAME_LENGTH) {
    throw new RangeError(`greet: name must be at most ${MAX_NAME_LENGTH} characters`)
  }

  const language = args.language ?? config.defaultLanguage
  if (!LANGUAGES.has(language)) {
    throw new TypeError('greet: language must be "en" or "zh"')
  }

  const style = args.style ?? config.defaultStyle
  if (!STYLES.has(style)) {
    throw new TypeError('greet: style must be "friendly" or "formal"')
  }

  return { name: normalizedName, language, style }
}

export function formatGreeting({ name, language, style }, config = DEFAULT_CONFIG) {
  if (language === 'zh') {
    return style === 'formal' ? `您好，${name}。` : `你好，${name}！`
  }
  if (style === 'formal') {
    return `Greetings, ${name}.`
  }
  return `${config.greeting}, ${name}${config.punctuation}`
}

export function apply(ctx, config) {
  const resolvedConfig = resolveConfig(config)

  ctx.tools.register(defineTool({
    name: 'greet',
    description: 'Greet someone by name in English or Chinese, using a friendly or formal style.',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'The name to greet. Leading and trailing whitespace is removed.',
      },
      language: {
        type: 'string',
        enum: ['en', 'zh'],
        default: resolvedConfig.defaultLanguage,
        description: 'Greeting language. Uses the plugin default when omitted.',
      },
      style: {
        type: 'string',
        enum: ['friendly', 'formal'],
        default: resolvedConfig.defaultStyle,
        description: 'Greeting style. Uses the plugin default when omitted.',
      },
    },
    output: {
      schema: {
        type: 'object',
        properties: {
          message: { type: 'string', required: true },
          name: { type: 'string', required: true },
          language: { type: 'string', enum: ['en', 'zh'], required: true },
          style: { type: 'string', enum: ['friendly', 'formal'], required: true },
        },
        additionalProperties: false,
      },
      render: (_args, value) => [{ type: 'text', text: value.message }],
    },
    async execute(args) {
      const resolvedArgs = resolveArguments(args, resolvedConfig)
      return {
        message: formatGreeting(resolvedArgs, resolvedConfig),
        ...resolvedArgs,
      }
    },
  }))
}
