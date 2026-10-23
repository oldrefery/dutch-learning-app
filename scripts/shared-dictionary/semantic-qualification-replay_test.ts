import assert from 'node:assert/strict'
import { join } from 'node:path'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { sha256 } from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { SEMANTIC_DIMENSIONS } from '../../supabase/functions/dictionary-analysis/semanticModel.ts'
import { qualificationCorpus } from './semantic-qualification-corpus.ts'
import { contextFor } from './semantic-qualification.ts'
import { replayQualification } from './semantic-qualification-replay.ts'

async function withReceipts(
  test: (manifest: string, judgePath: string) => Promise<void>,
  extra = false
) {
  const directory = await Deno.makeTempDir()
  try {
    const item = qualificationCorpus()[0],
      context = await contextFor(item)
    const verdict = {
      schema_version: 1,
      anchor_sha256: context.input.anchor.anchor_sha256,
      content_sha256: await sha256(canonicalizeJson(item.content)),
      result_sha256: context.receipt.result_sha256,
      decision: 'same-meaning',
      checks: SEMANTIC_DIMENSIONS.map(dimension => ({
        dimension,
        verdict: 'preserved',
        reason: 'Preserves the financial sense.',
        anchor_quote: 'financial institution',
      })),
      ...(extra ? { candidate_sha256: null } : {}),
    }
    const packet = {
      model: 'gemini-fixture-model',
      corpus: [item],
      requests: [
        { id: 'judge', case_id: item.id, kind: 'judge', context },
        { id: 'generation', case_id: item.id, kind: 'generation', context },
      ],
    }
    const result = (content: unknown) => ({
      result: {
        content: null,
        provider_response: {
          modelVersion: 'gemini-fixture-model',
          candidates: [
            {
              finishReason: 'STOP',
              content: {
                parts: [
                  {
                    text: JSON.stringify({ content }),
                    thoughtSignature: 'opaque-synthetic',
                  },
                ],
              },
            },
          ],
        },
      },
    })
    const paths = {
      [join(directory, 'packet.json')]: {
        packet,
        packet_sha256: await sha256(canonicalizeJson(packet)),
      },
      [join(directory, 'judge.result.json')]: result(verdict),
      [join(directory, 'generation.result.json')]: result(item.content),
      [join(directory, 'report.json')]: { qualified: false },
    }
    const hashes: Record<string, string> = {}
    for (const [path, value] of Object.entries(paths)) {
      const text = JSON.stringify(value)
      await Deno.writeTextFile(path, text)
      hashes[path] = await sha256(text)
    }
    const manifest = join(directory, 'manifest.json')
    await Deno.writeTextFile(
      manifest,
      JSON.stringify({
        provider_receipts_sha256: hashes,
        fresh_checks: {
          provider_pilot: {
            strict_report: join(directory, 'report.json'),
            packet_sha256: await sha256(canonicalizeJson(packet)),
          },
        },
      })
    )
    await test(manifest, join(directory, 'judge.result.json'))
  } finally {
    await Deno.remove(directory, { recursive: true })
  }
}
Deno.test(
  'offline replay uses actual signature-bearing envelope, preserves originals and performs no provider work',
  async () => {
    await withReceipts(async manifest => {
      const report = await replayQualification(manifest)
      assert.equal(report.mode, 'offline-replay')
      assert.equal(report.new_provider_calls, 0)
      assert.equal(report.qualified, false)
      assert.equal(report.new_request_schemas_exercised_by_provider, false)
      assert.equal(report.provider_envelopes_preserved, true)
      assert.equal(report.rows[0].decision, 'same-meaning')
      assert.equal(report.rows[0].original_content_null, true)
      assert.equal(report.generated[0].guard_valid, true)
      assert.equal(report.generated[0].semantic_judge_called, false)
    })
  }
)
Deno.test(
  'replay still rejects old generated extra fields without rewriting them',
  async () => {
    await withReceipts(async manifest => {
      const report = await replayQualification(manifest)
      assert.equal(report.invalid_verdicts, 1)
      assert.equal(report.rows[0].decision, 'invalid')
    }, true)
  }
)
Deno.test(
  'replay refuses an altered retained result before parsing it',
  async () => {
    await withReceipts(async (manifest, judge) => {
      await Deno.writeTextFile(judge, '{}')
      await assert.rejects(
        replayQualification(manifest),
        /Retained evidence changed/
      )
    })
  }
)
Deno.test(
  'replay verifies the original packet hash independently of file receipt hashes',
  async () => {
    await withReceipts(async manifest => {
      const value = JSON.parse(await Deno.readTextFile(manifest))
      value.fresh_checks.provider_pilot.packet_sha256 = '0'.repeat(64)
      await Deno.writeTextFile(manifest, JSON.stringify(value))
      await assert.rejects(
        replayQualification(manifest),
        /Original packet hash changed/
      )
    })
  }
)
