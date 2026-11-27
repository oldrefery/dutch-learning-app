import { timingSafeEqual } from 'node:crypto'
import { type BatchStore, runBatch } from './worker.ts'

const encode = new TextEncoder()
const sameSecret = (expected: string, given: string): boolean => {
  const left = encode.encode(expected)
  const right = encode.encode(given)
  return left.length === right.length && timingSafeEqual(left, right)
}

Deno.serve(async request => {
  if (request.method !== 'POST') return new Response(null, { status: 405 })
  const secret = Deno.env.get('CEFR_BATCH_WORKER_SECRET')
  if (
    !secret ||
    !sameSecret(secret, request.headers.get('x-cefr-batch-secret') ?? '')
  ) {
    return new Response(null, { status: 401 })
  }
  const url = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  if (!url || !serviceKey || !geminiKey) {
    return new Response(null, { status: 503 })
  }

  const rpc = async (
    name: string,
    parameters: Record<string, unknown> = {}
  ) => {
    const response = await fetch(`${url}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        authorization: `Bearer ${serviceKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(parameters),
      signal: AbortSignal.timeout(20_000),
    })
    if (!response.ok) throw new Error(`CEFR batch RPC failed: ${name}`)
    return response
  }
  const store: BatchStore = {
    next: async () => (await rpc('next_dictionary_cefr_batch_v1')).json(),
    record: async (id, name) => {
      await rpc('record_dictionary_cefr_batch_v1', {
        p_batch: id,
        p_provider_name: name,
      })
    },
    finish: async (id, results) => {
      await rpc('finish_dictionary_cefr_batch_v1', {
        p_batch: id,
        p_results: results,
      })
    },
  }
  try {
    return Response.json({ status: await runBatch(store, geminiKey) })
  } catch (error) {
    console.error(
      'CEFR batch worker failed',
      error instanceof Error ? error.message : 'Unexpected error'
    )
    return Response.json({ status: 'failed' }, { status: 502 })
  }
})
