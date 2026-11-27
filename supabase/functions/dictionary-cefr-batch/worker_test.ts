import { deepStrictEqual, rejects, strictEqual } from 'node:assert'
import { type BatchStore, runBatch } from './worker.ts'

const estimated = (text: string) => ({
  response: {
    candidates: [{ finishReason: 'STOP', content: { parts: [{ text }] } }],
  },
})

Deno.test('submits the phrase and records the asynchronous receipt', async () => {
  const meaning = { lemma: 'zin hebben in', original: 'ik heb er zin in' }
  const store: BatchStore = {
    next: () =>
      Promise.resolve({
        action: 'submit',
        batch_id: 'our-id',
        requests: [{ entry_id: 'entry', meaning }],
      }),
    record: (id, name) => {
      deepStrictEqual([id, name], ['our-id', 'batches/provider-id'])
      return Promise.resolve()
    },
    finish: () => Promise.reject(new Error('Unexpected settlement')),
  }
  const request: typeof fetch = (url, init) => {
    strictEqual(
      String(url).split('/').pop(),
      'gemini-3.6-flash:batchGenerateContent',
    )
    const batch = JSON.parse(String(init?.body)).batch
    strictEqual(batch.display_name, 'woordenaar-cefr-our-id')
    const [item] = batch.input_config.requests.requests
    strictEqual(item.metadata.key, 'entry')
    deepStrictEqual(JSON.parse(item.request.contents[0].parts[0].text), meaning)
    return Promise.resolve(Response.json({ name: 'batches/provider-id' }))
  }
  strictEqual(await runBatch(store, 'test', request), 'submitted')
})

Deno.test('maps valid, uncertain and failed results without losing entry identity', async () => {
  const entry_ids = ['one', 'two', 'three']
  const store: BatchStore = {
    next: () =>
      Promise.resolve({
        action: 'poll',
        batch_id: 'our-id',
        provider_name: 'batches/job',
        entry_ids,
      }),
    record: () => Promise.reject(new Error('Unexpected receipt')),
    finish: (id, results) => {
      strictEqual(id, 'our-id')
      deepStrictEqual(results, {
        one: { outcome: 'estimated', level: 'B1', confidence: 0.9 },
        two: { outcome: 'unknown' },
        three: { outcome: 'failed' },
      })
      return Promise.resolve()
    },
  }
  const responses = [
    {
      metadata: { key: 'one' },
      ...estimated('{"level":"B1","confidence":0.9}'),
    },
    {
      metadata: { key: 'two' },
      ...estimated('{"level":"B2","confidence":0.6}'),
    },
    { error: { code: 14 } },
  ]
  const response = (items: unknown[], operation = false): typeof fetch => () =>
    Promise.resolve(Response.json({
      name: 'batches/job',
      ...(operation
        ? {
          metadata: { state: 'JOB_STATE_SUCCEEDED' },
          response: { inlinedResponses: { inlinedResponses: items } },
        }
        : { state: 'JOB_STATE_SUCCEEDED', dest: { inlinedResponses: items } }),
    }))
  strictEqual(
    await runBatch(store, 'test', response(responses)),
    'completed',
  )
  await rejects(
    runBatch(store, 'test', response(responses.slice(1))),
    /result count/,
  )
  strictEqual(
    await runBatch(store, 'test', response(responses.toReversed(), true)),
    'completed',
  )
  await rejects(
    runBatch(
      store,
      'test',
      response([responses[0], responses[0], responses[2]]),
    ),
    /identity mismatch/,
  )
  await rejects(
    runBatch(
      store,
      'test',
      response([
        estimated('{"level":"B1","confidence":0.9}'),
        ...responses.slice(1),
      ]),
    ),
    /identity mismatch/,
  )
})

Deno.test('recovers a lost receipt via GET without submitting again', async () => {
  const store: BatchStore = {
    next: () =>
      Promise.resolve({ action: 'awaiting_receipt', batch_id: 'our-id' }),
    record: (id, name) => {
      deepStrictEqual([id, name], ['our-id', 'batches/found'])
      return Promise.resolve()
    },
    finish: () => Promise.reject(new Error('Unexpected settlement')),
  }
  strictEqual(
    await runBatch(store, 'test', (_url, init) => {
      strictEqual(init?.method, 'GET')
      return Promise.resolve(Response.json({
        operations: [
          { name: 'batches/other', metadata: { displayName: 'other' } },
          {
            name: 'batches/found',
            metadata: { displayName: 'woordenaar-cefr-our-id' },
          },
        ],
      }))
    }),
    'receipt_recovered',
  )
})
