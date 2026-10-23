import { createDictionaryAnalysisRuntime } from './runtime.ts'

// Not deployed by this change. An absent explicit flag serves only disabled503.
const handler = await createDictionaryAnalysisRuntime(
  name => Deno.env.get(name),
  async options => {
    const { createIndependentDictionaryAnalysisEndpoint } =
      await import('./endpoint.ts')
    return createIndependentDictionaryAnalysisEndpoint(options)
  }
)
Deno.serve(handler)
