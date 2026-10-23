import { createDictionaryCreationRuntime } from './runtime.ts'

const handler = await createDictionaryCreationRuntime(
  name => Deno.env.get(name),
  async options => {
    const { createConfiguredCreationEndpoint } = await import('./bootstrap.ts')
    return createConfiguredCreationEndpoint(options)
  }
)
Deno.serve(handler)
