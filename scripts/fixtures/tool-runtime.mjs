import assert from 'node:assert/strict'

// Harness 0.2.2 separates execution from registration. Only standalone tests
// mount an executor here; the Web probe must use the host's own composition.
export async function mountTestExecutor(ctx) {
  if (typeof ctx.tools.setExecutor === 'function') {
    await ctx.plugin(await import('@deepseek-ai/dsh-tool-executor-native'))
  }
}

export async function executeTool(ctx, input) {
  if (typeof ctx.tools.setExecutor !== 'function') return ctx.tools.execute(input)

  const batch = await ctx.tools.execute({
    signal: input.signal,
    calls: [{
      type: 'tool-call',
      id: input.callId,
      name: input.name,
      arguments: JSON.stringify(input.arguments),
    }],
  })
  assert.equal(batch.results.length, 1)
  assert.equal(batch.results[0].callId, input.callId)
  return batch.results[0].result
}
