import assert from 'node:assert/strict'
import { canonicalizeJson } from '../../../packages/domain/src/shared-dictionary.ts'
import { createGeminiTransport } from '../dictionary-analysis/geminiTransport.ts'
import { record, sha256 } from '../dictionary-analysis/protectedInput.ts'
import { qualificationCorpus } from '../../../scripts/shared-dictionary/semantic-qualification-corpus.ts'
import {
  CREATION_CANDIDATE_MODELS,
  creationFixture,
  creationJudgeRequest,
  type CreationQualificationRequest,
} from '../../../scripts/shared-dictionary/creation-qualification.ts'
import {
  buildCreationGeminiProfile,
  prepareCreationRequest,
} from './geminiModel.ts'
import { createCreationGeminiTransport } from './geminiTransport.ts'
import { parseCreationGrant } from './contracts.ts'
import { runDictionaryCreation, type CreationStore } from './worker.ts'

async function fixture() {
  const profile = await buildCreationGeminiProfile(CREATION_CANDIDATE_MODELS)
  const item = qualificationCorpus()[0]
  const f = await creationFixture(item, profile)
  const parent: CreationQualificationRequest = {
    id: 'generation-positive-1',
    case_id: item.id,
    phase: 'generation',
    ...f,
    request: await prepareCreationRequest('generation', f.grant, profile),
  }
  const judge = await creationJudgeRequest(parent, f.context.result, profile)
  assert.ok(judge)
  return { profile, parent, judge }
}
Deno.test(
  'creation HTTP mapping preserves committed input and separates grant and request hashes',
  async () => {
    const { profile, parent, judge } = await fixture()
    const sent: {
      url: string
      body: string
      redirect: unknown
    }[] = []
    const raw = {
      modelVersion: profile.generation_model_version,
      responseId: 'fixture-response',
      candidates: [
        {
          finishReason: 'STOP',
          content: {
            parts: [
              {
                text: JSON.stringify({
                  content: parent.context.result.content,
                }),
                thoughtSignature: 'opaque-metadata',
              },
            ],
          },
        },
      ],
    }
    const transport = await createCreationGeminiTransport({
      profile,
      transport: createGeminiTransport({
        apiKey: 'fixture-key',
        fetch: (url, options) => {
          const init = record(options)
          assert.equal(record(init.headers)['x-goog-api-key'], 'fixture-key')
          sent.push({
            url: String(url),
            body: String(init.body),
            redirect: init.redirect,
          })
          return Promise.resolve(new Response(JSON.stringify(raw)))
        },
      }),
    })
    for (const row of [parent, judge]) {
      const returned = await transport.invoke(row.phase, row.grant)
      assert.equal(returned.kind, 'returned')
      if (returned.kind !== 'returned') throw new Error('expected-returned')
      assert.deepEqual(returned.result.provider_response, raw)
      const call = sent.at(-1)!
      assert.equal(
        call.url,
        `https://generativelanguage.googleapis.com/v1beta/models/${row.grant.model}:generateContent`
      )
      assert.equal(call.redirect, 'error')
      const body = JSON.parse(call.body)
      const data = JSON.parse(body.contents[0].parts[0].text)
      assert.deepEqual(data.creation_input, row.grant.input)
      assert.equal(
        body.generationConfig.responseFormat.text.mimeType,
        'APPLICATION_JSON'
      )
      assert.equal(row.request.grant_input_sha256, row.grant.input_sha256)
      assert.notEqual(row.request.input_sha256, row.grant.input_sha256)
      assert.equal(
        row.request.input_sha256,
        await sha256(
          canonicalizeJson({
            provider: 'gemini',
            model: row.grant.model,
            body: call.body,
          })
        )
      )
      if (row.phase === 'judgement')
        assert.deepEqual(data.binding, {
          schema_version: 1,
          anchor_sha256: record(row.grant.input.anchor).anchor_sha256,
          content_sha256: row.grant.input.content_sha256,
          result_sha256: row.grant.input.result_sha256,
        })
    }
    assert.equal(sent.length, 2)
  }
)
for (const status of [400, 408, 503])
  Deno.test(
    `creation preserves HTTP${status} outcome without another request`,
    async () => {
      const { profile, parent } = await fixture()
      let calls = 0
      const transport = await createCreationGeminiTransport({
        profile,
        transport: createGeminiTransport({
          apiKey: 'fixture-key',
          fetch: () => {
            calls++
            return Promise.resolve(
              new Response('{"error":{"status":"INVALID_ARGUMENT"}}', {
                status,
              })
            )
          },
        }),
      })
      const result = await transport.invoke('generation', parent.grant)
      assert.equal(
        result.kind,
        status === 400 ? 'provider-failed' : 'provider-outcome-unknown'
      )
      assert.equal(calls, 1)
    }
  )
Deno.test(
  'creation profile refuses aliases pinned to the same observed model and prompt tampering',
  async () => {
    await assert.rejects(
      buildCreationGeminiProfile({
        ...CREATION_CANDIDATE_MODELS,
        judgement_model: 'gemini-3.7-flash',
        judgement_model_version:
          CREATION_CANDIDATE_MODELS.generation_model_version,
      })
    )
    const { profile } = await fixture()
    await assert.rejects(
      createCreationGeminiTransport({
        profile: { ...profile, prompt_sha256: 'f'.repeat(64) },
        transport: {
          invoke: () => {
            throw new Error('unexpected-provider')
          },
        },
      })
    )
  }
)
for (const key of [
  'model',
  'fence',
  'input_sha256',
  'policy_sha256',
  'prompt_sha256',
])
  Deno.test(`creation rejects changed ${key} before HTTP`, async () => {
    const { profile, judge } = await fixture()
    let calls = 0
    const transport = await createCreationGeminiTransport({
      profile,
      transport: {
        invoke: () => {
          calls++
          throw new Error('unexpected-provider')
        },
      },
    })
    const grant = structuredClone(judge.grant)
    if (key === 'policy_sha256' || key === 'prompt_sha256') {
      grant.input[key] = 'f'.repeat(64)
      grant.input_sha256 = await sha256(canonicalizeJson(grant.input))
    } else if (key === 'fence') grant.fence = '9007199254740993'
    else if (key === 'model') grant.model = profile.generation_model
    else grant.input_sha256 = 'f'.repeat(64)
    await assert.rejects(transport.invoke('judgement', grant))
    assert.equal(calls, 0)
  })
Deno.test(
  'creation oversized input refuses before HTTP and BIGINT fence stays exact',
  async () => {
    const { profile, parent } = await fixture()
    const grant = structuredClone(parent.grant)
    grant.fence = '9007199254740993'
    assert.equal(
      (await prepareCreationRequest('generation', grant, profile))
        .grant_input_sha256,
      grant.input_sha256
    )
    grant.input.evidence_sha256 = 'private-payload'.repeat(4000)
    grant.input_sha256 = await sha256(canonicalizeJson(grant.input))
    await assert.rejects(
      prepareCreationRequest('generation', grant, profile),
      /request-too-large/
    )
  }
)
Deno.test(
  'worker journals raw wrong observed version using SQL grant hash and no judge call',
  async () => {
    const { profile, parent } = await fixture()
    let calls = 0,
      journalled = false
    const receipt = { ...parent.receipt, status: 'accepted' as const }
    const reviewed = {
      ...receipt,
      status: 'review-required' as const,
      result_sha256: 'e'.repeat(64),
      error_code: 'meaning-uncertain',
    }
    const unused = (): never => {
      throw new Error('unexpected-store-call')
    }
    const store: CreationStore = {
      accept: () => Promise.resolve(receipt),
      read: () => Promise.resolve({ run_id: parent.grant.run_id, receipt }),
      dispatch: () =>
        Promise.resolve({ receipt: parent.receipt, dispatch: parent.grant }),
      journal: (_phase, grant, result) => {
        assert.equal(grant.input_sha256, parent.grant.input_sha256)
        assert.equal(
          record(result.provider_response).modelVersion,
          profile.judgement_model_version
        )
        journalled = true
        return Promise.resolve(reviewed)
      },
      failure: unused,
      validate: unused,
      publish: unused,
    }
    const transport = await createCreationGeminiTransport({
      profile,
      transport: {
        invoke: () => {
          calls++
          return Promise.resolve({
            kind: 'returned',
            requestId: 'fixture-wrong-version',
            result: {
              ...parent.context.result,
              provider_response: {
                modelVersion: profile.judgement_model_version,
              },
            },
          })
        },
      },
    })
    const result = await runDictionaryCreation(
      'fixture-actor',
      {
        protocol_version: 2,
        operation_id: receipt.operation_id,
        resolution_id: receipt.resolution_id,
      },
      {
        store,
        profile,
        transport,
        verifyActor: () => Promise.resolve('fixture-actor'),
      }
    )
    assert.ok('status' in result)
    assert.equal(result.status, 'review-required')
    assert.equal(calls, 1)
    assert.equal(journalled, true)
  }
)
Deno.test(
  'worker lost journal reply retains raw outcome and resume never redispatches',
  async () => {
    const { profile, parent } = await fixture()
    let calls = 0,
      stored = false
    const accepted = { ...parent.receipt, status: 'accepted' as const }
    const unused = (): never => {
      throw new Error('unexpected-store-call')
    }
    const store: CreationStore = {
      accept: () =>
        Promise.resolve(
          stored
            ? {
                ...parent.receipt,
                status: 'provider-outcome-unknown',
                error_code: 'provider-outcome-unknown',
              }
            : accepted
        ),
      read: () =>
        Promise.resolve({ run_id: parent.grant.run_id, receipt: accepted }),
      dispatch: () =>
        Promise.resolve({ receipt: parent.receipt, dispatch: parent.grant }),
      journal: () => {
        stored = true
        throw new Error('lost-journal-reply')
      },
      failure: unused,
      validate: unused,
      publish: unused,
    }
    const transport = await createCreationGeminiTransport({
      profile,
      transport: {
        invoke: () => {
          calls++
          return Promise.resolve({
            kind: 'returned',
            requestId: 'fixture-returned',
            result: parent.context.result,
          })
        },
      },
    })
    const command = {
      protocol_version: 2 as const,
      operation_id: accepted.operation_id,
      resolution_id: accepted.resolution_id,
    }
    const deps = {
      store,
      profile,
      transport,
      verifyActor: () => Promise.resolve('fixture-actor'),
    }
    await assert.rejects(
      runDictionaryCreation('fixture-actor', command, deps),
      /lost-journal-reply/
    )
    const resumed = await runDictionaryCreation('fixture-actor', command, deps)
    assert.ok('status' in resumed)
    assert.equal(resumed.status, 'provider-outcome-unknown')
    assert.equal(calls, 1)
  }
)
Deno.test(
  'hash-correct caller fields cannot become committed generation grants',
  async () => {
    const { profile, parent } = await fixture()
    const input = { ...parent.grant.input, original_query: 'private-query' }
    await assert.rejects(
      parseCreationGrant(
        {
          ...parent.grant,
          input,
          input_sha256: await sha256(canonicalizeJson(input)),
        },
        'generation',
        parent.grant.run_id,
        parent.receipt,
        profile
      )
    )
  }
)
