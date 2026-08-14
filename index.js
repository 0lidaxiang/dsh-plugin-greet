export const name = 'greet-tool'
export const inject = ['tools']

export function apply(ctx) {
  ctx.tools.register({
    name: 'greet',
    description: 'Greet someone by name.',
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'The name to greet.',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value }],
    },
    async execute(args) {
      if (typeof args !== 'object' || args === null || typeof args.name !== 'string') {
        throw new TypeError('greet: name must be a string')
      }
      return `Hello, ${args.name}!`
    },
  })
}
