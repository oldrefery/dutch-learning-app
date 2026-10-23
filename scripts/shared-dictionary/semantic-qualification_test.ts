import assert from 'node:assert/strict'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { sha256 } from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { createGeminiTransport } from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
import wireContract from '../../supabase/functions/dictionary-analysis/fixtures/google-text-response-format-20261010.json' with { type: 'json' }
import { SEMANTIC_DIMENSIONS } from '../../supabase/functions/dictionary-analysis/semanticModel.ts'
import {
  contextFor,
  generatedJudge,
  MODEL,
  prepareQualification,
  scoreJudge,
  summarizeQualification,
} from './semantic-qualification.ts'
import { qualificationCorpus } from './semantic-qualification-corpus.ts'
import {
  frozenPacket,
  runQualification,
  validateUsage,
  writeOnce,
} from './semantic-qualification-cli.ts'

const PILOT_TIME = Date.parse('2026-10-11T12:00:00Z')

Deno.test(
  'corpus covers all six dimensions, ambiguity and pre-provider guards without personal cards',
  async () => {
    const packet = await prepareQualification()
    assert.equal(packet.corpus.length, 42)
    assert.equal(new Set(packet.corpus.map(row => row.id)).size, 42)
    assert.deepEqual(packet.guards, ['guard-identity', 'guard-media'])
    for (const [category, count] of [
      ['positive', 14],
      ['negative', 14],
      ['uncertain', 12],
      ['guard', 2],
    ])
      assert.equal(
        packet.corpus.filter(row => row.category === category).length,
        count
      )
    assert.equal(packet.requests.length, 44)
    assert.equal(packet.limits.provider_calls, 48)
    assert.equal(packet.qualified, false)
  }
)
Deno.test(
  'frozen packet is deterministic and binds current model, prompts, sources and corpus',
  async () => {
    const first = await frozenPacket(),
      second = await frozenPacket()
    assert.deepEqual(first, second)
    assert.equal(
      first.packet_sha256,
      await sha256(canonicalizeJson(first.packet))
    )
    assert.equal(first.packet.policy.generation_model, MODEL)
    assert.equal(first.packet.policy.model, MODEL)
    assert.ok(Object.keys(first.packet.source_sha256).length >= 8)
  }
)
Deno.test(
  'expected labels and rationale do not enter judge payloads; production limits stay unchanged',
  async () => {
    for (const row of (await prepareQualification()).requests) {
      const payload = JSON.parse(
        JSON.parse(row.request.body).contents[0].parts[0].text
      )
      assert.deepEqual(
        Object.keys(payload).sort(),
        row.kind === 'judge'
          ? ['binding', 'candidate', 'protected_input']
          : ['content_template', 'protected_input']
      )
      assert.equal(
        JSON.parse(row.request.body).generationConfig.maxOutputTokens,
        8192
      )
      assert.equal(
        row.request.input_sha256,
        await sha256(
          canonicalizeJson({
            provider: 'gemini',
            model: MODEL,
            body: row.request.body,
          })
        )
      )
    }
  }
)
Deno.test(
  'generated output must pass real guards before getting a separate bound judge request',
  async () => {
    const packet = await prepareQualification(),
      parent = packet.requests.find(row => row.kind === 'generation')!
    assert.equal(
      await generatedJudge(parent, { content: { wrong: true } }),
      null
    )
    const result = {
      content: parent.context.result.content,
      provider_response: { modelVersion: MODEL },
    }
    const judge = await generatedJudge(parent, result)
    assert.ok(judge)
    assert.equal(
      judge.context.receipt.result_sha256,
      await sha256(canonicalizeJson(result))
    )
    assert.notEqual(judge.id, parent.id)
    assert.equal(judge.request.body.includes('provider_response'), false)
  }
)
Deno.test(
  'real verdict parser rejects bad bindings and records uncertain separately from rejection',
  async () => {
    const row = (await prepareQualification()).requests[0]
    const hash = await sha256(canonicalizeJson(row.context.result.content))
    const content = {
      schema_version: 1,
      anchor_sha256: row.context.input.anchor.anchor_sha256,
      content_sha256: hash,
      result_sha256: row.context.receipt.result_sha256,
      decision: 'uncertain',
      checks: SEMANTIC_DIMENSIONS.map(dimension => ({
        dimension,
        verdict: 'uncertain',
        reason: 'Synthetic parser test, not model evidence.',
        anchor_quote: row.context.input.anchor.gloss,
      })),
    }
    const result = {
      content,
      provider_response: {
        modelVersion: MODEL,
        usageMetadata: { promptTokenCount: 20, totalTokenCount: 100 },
      },
    }
    assert.equal(scoreJudge(row, result, hash).decision, 'uncertain')
    assert.equal(scoreJudge(row, result, 'f'.repeat(64)).decision, 'invalid')
  }
)
Deno.test(
  'empty, unsafe and mixed-version results never assert qualification',
  () => {
    assert.equal(summarizeQualification([]).complete_single_version, false)
    const report = summarizeQualification([
      { category: 'negative', decision: 'same-meaning', model_version: MODEL },
      { category: 'uncertain', decision: 'invalid', model_version: null },
    ])
    assert.equal(report.false_acceptances, 1)
    assert.equal(report.invalid_verdicts, 1)
    assert.equal(report.qualified, false)
    assert.equal(report.complete_single_version, false)
  }
)
Deno.test(
  'provider token and actual-version evidence is mandatory and bounded',
  () => {
    assert.throws(() => validateUsage({ provider_response: {} }))
    assert.throws(() =>
      validateUsage({
        provider_response: { modelVersion: 'gemini-other', usageMetadata: {} },
      })
    )
    assert.throws(() =>
      validateUsage({
        provider_response: {
          modelVersion: MODEL,
          usageMetadata: { promptTokenCount: 32769, totalTokenCount: 32770 },
        },
      })
    )
    assert.throws(() =>
      validateUsage({
        provider_response: {
          modelVersion: MODEL,
          usageMetadata: { promptTokenCount: 1, totalTokenCount: 65538 },
        },
      })
    )
    assert.equal(
      validateUsage({
        provider_response: {
          modelVersion: MODEL,
          usageMetadata: { promptTokenCount: 100, totalTokenCount: 1000 },
        },
      }),
      MODEL
    )
  }
)
Deno.test(
  'proposed anchors have deterministic content hashes rather than fabricated authority receipts',
  async () => {
    const item = qualificationCorpus()[0],
      context = await contextFor(item)
    assert.notEqual(context.input.anchor.anchor_sha256, '0'.repeat(64))
    assert.equal(item.input.anchor.anchor_sha256, '0'.repeat(64))
    assert.equal(
      context.receipt.result_sha256,
      await sha256(
        canonicalizeJson({
          content: item.content,
          provider_response: { modelVersion: MODEL },
        })
      )
    )
  }
)
Deno.test(
  'durable dispatch prevents retry after unknown provider outcome, including process-style resume',
  async () => {
    const directory = await Deno.makeTempDir()
    try {
      const packet = await frozenPacket(),
        path = `${directory}/input.json`,
        output = `${directory}/run`
      await writeOnce(path, packet)
      let calls = 0
      const factory = () => ({
        invoke: () => {
          calls++
          return Promise.resolve({
            kind: 'provider-outcome-unknown' as const,
            evidence_sha256: null,
          })
        },
      })
      await assert.rejects(
        runQualification(
          path,
          output,
          packet.packet_sha256,
          factory,
          () => PILOT_TIME
        ),
        /no retry/
      )
      await assert.rejects(
        runQualification(
          path,
          output,
          packet.packet_sha256,
          factory,
          () => PILOT_TIME
        ),
        /without redispatch/
      )
      assert.equal(calls, 1)
      assert.ok(
        await Deno.stat(
          `${output}/${packet.packet.requests[0].id}.dispatch.json`
        )
      )
      await assert.rejects(
        Deno.stat(`${output}/run.lock`),
        Deno.errors.NotFound
      )
    } finally {
      await Deno.remove(directory, { recursive: true })
    }
  }
)
Deno.test(
  'wrong approval hash cannot read credentials or dispatch and writeOnce cannot overwrite evidence',
  async () => {
    const directory = await Deno.makeTempDir()
    try {
      const packet = await frozenPacket(),
        path = `${directory}/input.json`
      await writeOnce(path, packet)
      await assert.rejects(writeOnce(path, {}), Deno.errors.AlreadyExists)
      await assert.rejects(
        runQualification(path, `${directory}/run`, 'f'.repeat(64), () => {
          throw new Error('must not construct transport')
        }),
        /packet or source changed/
      )
    } finally {
      await Deno.remove(directory, { recursive: true })
    }
  }
)

Deno.test(
  'complete synthetic run journals48 attempts and exact resume performs zero new calls',
  async () => {
    const directory = await Deno.makeTempDir()
    try {
      const packet = await frozenPacket(),
        path = `${directory}/input.json`,
        output = `${directory}/run`
      await writeOnce(path, packet)
      let calls = 0,
        time = PILOT_TIME
      const now = () => (time += 61001)
      const factory = () => ({
        invoke: (request: { body: string }) => {
          calls++
          const data = JSON.parse(
            JSON.parse(request.body).contents[0].parts[0].text
          )
          const content = data.binding
            ? {
                ...data.binding,
                decision: 'uncertain',
                checks: SEMANTIC_DIMENSIONS.map(dimension => ({
                  dimension,
                  verdict: 'uncertain',
                  reason: 'Synthetic test transport, not provider evidence.',
                  anchor_quote: data.protected_input.anchor.gloss,
                })),
              }
            : packet.packet.corpus.find(
                row =>
                  row.category === 'positive' &&
                  row.input.anchor.gloss === data.protected_input.anchor.gloss
              )!.content
          return Promise.resolve({
            kind: 'returned' as const,
            requestId: `synthetic-${calls}`,
            result: {
              content,
              provider_response: {
                modelVersion: MODEL,
                usageMetadata: { promptTokenCount: 100, totalTokenCount: 200 },
              },
            },
          })
        },
      })
      const report = await runQualification(
        path,
        output,
        packet.packet_sha256,
        factory,
        now
      )
      assert.equal(calls, 48)
      assert.equal(report.completed_judge_results, 40)
      assert.equal(report.generated.length, 4)
      assert.deepEqual(report.execution_scope, packet.packet.execution_scope)
      assert.equal(report.false_acceptances, 0)
      assert.equal(report.positive_acceptance, 0)
      assert.equal(report.qualified, false)
      assert.deepEqual(
        await runQualification(
          path,
          output,
          packet.packet_sha256,
          factory,
          now
        ),
        report
      )
      assert.equal(calls, 48)
    } finally {
      await Deno.remove(directory, { recursive: true })
    }
  }
)
Deno.test(
  'retained attempt ceiling and expired authority stop before a new request',
  async () => {
    const directory = await Deno.makeTempDir()
    try {
      const packet = await frozenPacket(),
        path = `${directory}/input.json`,
        output = `${directory}/run`
      await writeOnce(path, packet)
      await Deno.mkdir(output)
      for (let i = 0; i < 48; i++)
        await writeOnce(`${output}/held-${i}.dispatch.json`, {
          dispatched_at: 0,
        })
      let calls = 0
      const factory = () => ({
        invoke: () => {
          calls++
          throw new Error('must not dispatch')
        },
      })
      await assert.rejects(
        runQualification(
          path,
          output,
          packet.packet_sha256,
          factory,
          () => PILOT_TIME
        ),
        /budget exhausted/
      )
      await assert.rejects(
        runQualification(path, output, packet.packet_sha256, factory, () =>
          Date.parse('2026-10-19T12:00:00Z')
        ),
        /expired/
      )
      assert.equal(calls, 0)
    } finally {
      await Deno.remove(directory, { recursive: true })
    }
  }
)
Deno.test(
  'mixed actual model versions preserve returned receipts and stop before the third call',
  async () => {
    const directory = await Deno.makeTempDir()
    try {
      const packet = await frozenPacket(),
        path = `${directory}/input.json`,
        output = `${directory}/run`
      await writeOnce(path, packet)
      let calls = 0
      const factory = () => ({
        invoke: () => {
          calls++
          return Promise.resolve({
            kind: 'returned' as const,
            requestId: 'synthetic',
            result: {
              content: null,
              provider_response: {
                modelVersion: calls === 1 ? MODEL : `${MODEL}-changed`,
                usageMetadata: { promptTokenCount: 100, totalTokenCount: 200 },
              },
            },
          })
        },
      })
      await assert.rejects(
        runQualification(
          path,
          output,
          packet.packet_sha256,
          factory,
          () => PILOT_TIME
        ),
        /unexpected provider model version/
      )
      assert.equal(calls, 2)
      assert.ok(
        await Deno.stat(`${output}/${packet.packet.requests[1].id}.result.json`)
      )
    } finally {
      await Deno.remove(directory, { recursive: true })
    }
  }
)

Deno.test(
  'expanded coverage has distinct negative senses, four parts of speech and all six outcome dimensions',
  async () => {
    const packet = await prepareQualification(),
      corpus = packet.corpus
    assert.deepEqual(
      [...new Set(corpus.map(row => row.input.entry.part_of_speech))].sort(),
      ['adjective', 'expression', 'noun', 'verb']
    )
    assert.ok(
      new Set(
        corpus
          .filter(row => row.category === 'negative')
          .map(row => row.input.entry.sense_key)
      ).size >= 6
    )
    for (const category of ['positive', 'negative', 'uncertain'])
      for (const dimension of SEMANTIC_DIMENSIONS)
        assert.ok(
          corpus.some(
            row =>
              row.category === category && row.dimensions.includes(dimension)
          ),
          `${category}/${dimension}`
        )
    assert.ok(
      corpus.some(
        row =>
          row.category === 'positive' &&
          row.content.usage_notes?.contrasts.some(
            contrast => contrast.example !== null
          )
      )
    )
    const nested = corpus.find(
      row => row.id === 'expanded-negative-nested-example'
    )!
    assert.equal(
      nested.content.usage_notes!.contrasts[0].example!.en,
      'The key fits the castle of the door.'
    )
    assert.equal(packet.expected_judge_results, 40)
    assert.equal(packet.judge_repeats_per_case, 1)
    assert.equal(packet.generation_cases.length, 4)
    assert.deepEqual(
      [
        ...new Set(
          packet.requests
            .filter(row => row.kind === 'generation')
            .map(row => row.context.input.entry.part_of_speech)
        ),
      ].sort(),
      ['adjective', 'expression', 'noun', 'verb']
    )
    assert.equal(packet.requests.length + packet.generation_cases.length, 48)
  }
)

Deno.test(
  'packet explicitly bounds direct analysis probes and excludes creation, publication and activation',
  async () => {
    const { packet } = await frozenPacket()
    assert.equal(packet.execution_scope.workflow, 'dictionary-analysis')
    assert.equal(packet.execution_scope.request_mode, 'direct-request-probes')
    assert.ok(
      packet.execution_scope.covers.includes('independent-semantic-judging')
    )
    for (const workflow of [
      'dictionary-creation',
      'database-publication',
      'client-device-behavior',
      'runtime-activation',
    ])
      assert.ok(packet.execution_scope.excludes.includes(workflow))
    assert.ok(
      packet.execution_scope.creation_requirement.includes(
        'separate compatible'
      )
    )
    assert.equal(packet.qualified, false)
    assert.equal(packet.limits.provider_calls, 48)
    assert.equal(packet.limits.usd_authority_ceiling, 15)
  }
)

Deno.test(
  'suffix or missing observed versions cannot score or generate a contingent judge',
  async () => {
    const packet = await prepareQualification(),
      parent = packet.requests.find(row => row.kind === 'generation')!
    for (const version of [undefined, `${MODEL}-unqualified`, 7]) {
      const result = {
        content: parent.context.result.content,
        provider_response: { modelVersion: version },
      }
      assert.equal(await generatedJudge(parent, result), null)
      assert.equal(
        scoreJudge(parent, result, 'a'.repeat(64)).decision,
        'invalid'
      )
      assert.throws(
        () => validateUsage(result),
        /unexpected provider model version/
      )
    }
  }
)

Deno.test(
  'fixed and contingent requests satisfy the saved public REST MIME enum',
  async () => {
    assert.equal(wireContract.revision, '20261010')
    const allowed = wireContract.TextResponseFormat.properties.mimeType.enum
    const packet = await prepareQualification()
    const requests = [...packet.requests]
    for (const parent of packet.requests.filter(
      row => row.kind === 'generation'
    )) {
      const judge = await generatedJudge(parent, {
        content: parent.context.result.content,
        provider_response: { modelVersion: MODEL },
      })
      assert.ok(judge)
      requests.push(judge)
    }
    assert.equal(requests.length, 48)
    for (const row of requests) {
      const config = JSON.parse(row.request.body).generationConfig
      assert.ok(allowed.includes(config.responseFormat.text.mimeType), row.id)
      assert.equal(config.candidateCount, 1)
      assert.equal(config.maxOutputTokens, 8192)
      assert.ok(config.responseFormat.text.schema)
    }
  }
)
Deno.test(
  'known failure retains safe diagnostics durably and refuses redispatch on resume',
  async () => {
    const directory = await Deno.makeTempDir()
    try {
      const packet = await frozenPacket(),
        path = `${directory}/input.json`,
        output = `${directory}/run`
      await writeOnce(path, packet)
      let calls = 0
      const factory = () =>
        createGeminiTransport({
          apiKey: 'private-fixture-key',
          fetch: () => {
            calls++
            return Promise.resolve(
              Response.json(
                {
                  error: {
                    code: 400,
                    status: 'INVALID_ARGUMENT',
                    message:
                      "Invalid value at 'generation_config.response_format.text.mime_type': private-fixture-key private-fixture-prompt",
                  },
                },
                { status: 400 }
              )
            )
          },
        })
      await assert.rejects(
        runQualification(
          path,
          output,
          packet.packet_sha256,
          factory,
          () => PILOT_TIME
        ),
        /no retry/
      )
      const failurePath = `${output}/${packet.packet.requests[0].id}.failure.json`
      const failureText = await Deno.readTextFile(failurePath)
      const failure = JSON.parse(failureText)
      assert.equal(failure.kind, 'provider-failed')
      assert.equal(failure.diagnostics?.http_status, 400)
      assert.equal(failure.diagnostics?.google_status, 'INVALID_ARGUMENT')
      assert.equal(failureText.includes('private-fixture'), false)
      await assert.rejects(
        runQualification(
          path,
          output,
          packet.packet_sha256,
          factory,
          () => PILOT_TIME
        ),
        /without redispatch/
      )
      assert.equal(await Deno.readTextFile(failurePath), failureText)
      assert.equal(calls, 1)
      await assert.rejects(
        Deno.stat(`${output}/run.lock`),
        Deno.errors.NotFound
      )
    } finally {
      await Deno.remove(directory, { recursive: true })
    }
  }
)
