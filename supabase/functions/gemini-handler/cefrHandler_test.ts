import { assertEquals, assert } from '@std/assert'
import { createGeminiCefrEstimate } from './cefr.ts'

// No sockets/listener or provider access: every HTTP operation is answered in memory.
const analysis = {
  dutch_lemma: 'huis',
  part_of_speech: 'noun',
  article: 'het',
  translations: { en: ['house'], ru: [] },
  examples: [{ nl: 'Dit is een huis.', en: 'This is a house.' }],
  cefr: {
    level: 'A1',
    confidence: 0.8,
    source: 'editorial',
    status: 'reviewed',
  },
}
const calls: {
  path: string
  query: string
  method: string
  body: Record<string, unknown>
}[] = []
let cached: Record<string, unknown>[] = []
let providerCefr: unknown = analysis.cefr
let providerArticle: string | null = 'het'
let duplicate = false
for (const [key, value] of Object.entries({
  SUPABASE_URL: 'http://127.0.0.1:54321',
  SUPABASE_ANON_KEY: 'synthetic-anon-key',
  SUPABASE_SERVICE_ROLE_KEY: 'synthetic-service-key',
  GEMINI_API_KEY: 'synthetic-provider-key',
}))
  Deno.env.set(key, value)
Deno.env.delete('UNSPLASH_ACCESS_KEY')
Deno.env.delete('SENTRY_DSN')
globalThis.fetch = async (input, init) => {
  const req = new Request(input, init)
  const url = new URL(req.url)
  const text = await req.text()
  const body: Record<string, unknown> = text ? JSON.parse(text) : {}
  calls.push({
    path: url.pathname,
    query: url.search,
    method: req.method,
    body,
  })
  const reply = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { 'content-type': 'application/json' },
    })
  if (url.hostname === 'generativelanguage.googleapis.com') {
    return reply({
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify({
                  ...analysis,
                  article: providerArticle,
                  cefr: providerCefr,
                }),
              },
            ],
          },
        },
      ],
    })
  }
  if (url.origin !== 'http://127.0.0.1:54321')
    throw new Error('Unexpected test destination')
  if (url.pathname === '/auth/v1/user')
    return reply({ id: '11111111-1111-4111-8111-111111111111' })
  if (url.pathname === '/rest/v1/user_access_levels')
    return reply({ access_level: 'full_access' })
  if (url.pathname === '/rest/v1/rpc/consume_edge_function_quota')
    return reply([{ allowed: true, remaining: 5, retry_after_seconds: 0 }])
  if (url.pathname === '/rest/v1/rpc/increment_cache_usage')
    return new Response(null, { status: 204 })
  if (url.pathname === '/rest/v1/word_analysis_cache') {
    if (req.method === 'GET') return reply(cached)
    if (req.method === 'POST' && duplicate)
      return reply({ code: '23505', message: 'Synthetic duplicate' }, 409)
    return new Response(null, { status: 201 })
  }
  throw new Error(`Unexpected test path: ${url.pathname}`)
}
let handler: (req: Request) => Promise<Response> = () =>
  Promise.reject(new Error('Handler not registered'))
const realServe = Deno.serve
Deno.serve = ((callback: typeof handler) => {
  handler = callback
  return {}
}) as unknown as typeof Deno.serve
try {
  await import('./index.ts')
} finally {
  Deno.serve = realServe
}

// Settle the module-level cache client initialization before test leak tracking.
await new Promise(resolve => setTimeout(resolve, 0))

const request = async (enabled: boolean) => {
  calls.length = 0
  if (enabled) Deno.env.set('CEFR_ANALYSIS_ENABLED', 'true')
  else Deno.env.delete('CEFR_ANALYSIS_ENABLED')
  const response = await handler(
    new Request('http://127.0.0.1/analysis', {
      method: 'POST',
      headers: {
        authorization: 'Bearer synthetic-user-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ word: 'het huis' }),
    })
  )
  assertEquals(response.status, 200)
  const data = await response.json()
  // The existing cache write is asynchronous; give its fake transport one turn.
  await new Promise(resolve => setTimeout(resolve, 0))
  return data
}

Deno.test(
  'default-off handler preserves legacy prompt, response and cache write',
  async () => {
    cached = []
    duplicate = false
    const result = await request(false)
    assertEquals(Object.hasOwn(result.data, 'cefr'), false)
    const write = calls.find(
      x => x.path === '/rest/v1/word_analysis_cache' && x.method === 'POST'
    )
    assert(write)
    assertEquals(Object.hasOwn(write.body, 'cefr_estimate'), false)
    const provider = calls.find(x => x.path.includes('/models/'))
    assert(provider)
    assertEquals(
      JSON.stringify(provider.body).includes('This is a model estimate'),
      false
    )
  }
)

Deno.test(
  'enabled fresh handler stamps estimates, persists them and clears invalid refresh',
  async () => {
    cached = []
    duplicate = true
    providerCefr = analysis.cefr
    const result = await request(true)
    assertEquals(
      calls.some(x =>
        JSON.stringify(x.body).includes('This is a model estimate')
      ),
      true
    )
    assertEquals(result.data.cefr.source, 'model')
    assertEquals(result.data.cefr.status, 'estimated')
    const write = calls.find(x => x.method === 'PATCH')
    assert(write)
    assertEquals(write.body.cefr_estimate, result.data.cefr)
    providerCefr = { level: 'A1', confidence: 9 }
    const invalid = await request(true)
    assertEquals(invalid.data.cefr, null)
    assertEquals(
      calls.find(x => x.method === 'PATCH')?.body.cefr_estimate,
      null
    )
    providerCefr = analysis.cefr
    duplicate = false
  }
)

Deno.test(
  'enabled cache hits support old rows and reject stale content without provider calls',
  async () => {
    cached = [
      {
        ...analysis,
        cache_id: '22222222-2222-4222-8222-222222222222',
        cache_version: 2,
        usage_count: 1,
      },
    ]
    const legacy = await request(true)
    assertEquals(legacy.data.cefr, null)
    const estimate = await createGeminiCefrEstimate(analysis.cefr, analysis)
    cached[0].cefr_estimate = estimate
    const current = await request(true)
    assertEquals(current.data.cefr, estimate)
    cached[0].translations = { en: ['home'], ru: [] }
    const stale = await request(true)
    assertEquals(stale.data.cefr, null)
    assertEquals(
      calls.some(x => x.path.includes('/models/')),
      false
    )
    assertEquals(
      calls.some(x => x.path.includes('consume_edge_function_quota')),
      false
    )
  }
)

Deno.test(
  'article-free cache refresh uses SQL NULL semantics for its duplicate row',
  async () => {
    cached = []
    duplicate = true
    providerArticle = null
    try {
      const result = await request(true)
      const write = calls.find(x => x.method === 'PATCH')
      assert(write)
      assertEquals(new URLSearchParams(write.query).get('article'), 'is.null')
      assertEquals(write.body.cefr_estimate, result.data.cefr)
    } finally {
      providerArticle = 'het'
      duplicate = false
    }
  }
)

Deno.test(
  'fresh persisted known and unknown estimates survive a real handler cache round-trip',
  async () => {
    try {
      for (const candidate of [
        analysis.cefr,
        { level: null, confidence: null },
      ]) {
        cached = []
        duplicate = false
        providerCefr = candidate
        const fresh = await request(true)
        assert(fresh.data.cefr)
        assertEquals(fresh.data.cefr.level, candidate.level)
        const write = calls.find(
          x => x.path === '/rest/v1/word_analysis_cache' && x.method === 'POST'
        )
        assert(write)
        assertEquals(write.body.cefr_estimate, fresh.data.cefr)
        cached = [
          { ...write.body, cache_id: '22222222-2222-4222-8222-222222222222' },
        ]
        const hit = await request(true)
        assertEquals(hit.meta.cache_hit, true)
        assertEquals(hit.data.cefr, fresh.data.cefr)
        assertEquals(
          calls.some(x => x.path.includes('/models/')),
          false
        )
        const disabled = await request(false)
        assertEquals(Object.hasOwn(disabled.data, 'cefr'), false)
      }
    } finally {
      cached = []
      providerCefr = analysis.cefr
    }
  }
)

Deno.test(
  'default-off duplicate refresh omits CEFR and stale retained metadata is rejected on re-enable',
  async () => {
    const prior = await createGeminiCefrEstimate(analysis.cefr, {
      ...analysis,
      translations: { en: ['household'], ru: [] },
    })
    assert(prior)
    cached = []
    duplicate = true
    try {
      await request(false)
      const write = calls.find(x => x.method === 'PATCH')
      assert(write)
      assertEquals(Object.hasOwn(write.body, 'cefr_estimate'), false)
      cached = [{ ...analysis, ...write.body, cefr_estimate: prior }]
      const hit = await request(true)
      assertEquals(hit.meta.cache_hit, true)
      assertEquals(hit.data.cefr, null)
      assertEquals(
        calls.some(x => x.path.includes('/models/')),
        false
      )
    } finally {
      cached = []
      duplicate = false
    }
  }
)
