import { resolve } from 'node:path'
import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { journalPacket } from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import {
  checkDeadline,
  equal,
  readJson,
  verifyRunBinding,
} from './creation-pilot-journal.ts'
import { reportedCharge, RESERVE_NANOUSD } from './creation-pilot-usage.ts'

const INVALID = 'invalid-completed-accounting-evidence'

// Billing follows the immutable dispatches and raw usage, not today's prompt or
// semantic parser. This verifies no qualification, publication or renewed claim.
export async function completedRunCharge(
  allocation: Record<string, unknown>,
  hashes: Record<string, unknown>
) {
  const directory = String(allocation.run_directory)
  equal(directory, resolve(directory), INVALID)
  const run = await readJson(`${directory}/run.json`)
  const authority = await verifyRunBinding(run)
  for (const key of Object.keys(run))
    equal(run[key], allocation[key], 'allocation-run-binding-conflict')
  const saved = await readJson(`${directory}/packet.json`)
  const packet = record(saved.packet)
  equal(await sha256(canonicalizeJson(packet)), saved.packet_sha256, INVALID)
  equal(saved.packet_sha256, allocation.packet_sha256, INVALID)
  const profile = record(packet.profile)
  const expiry = record(packet.limits).packet_valid_until
  if (
    ![5, 6, 7].includes(Number(packet.schema_version)) ||
    !Array.isArray(packet.requests) ||
    packet.requests.length !== 44 ||
    typeof expiry !== 'string' ||
    typeof profile.generation_model_version !== 'string' ||
    typeof profile.judgement_model_version !== 'string'
  )
    throw new Error(INVALID)
  checkDeadline(authority, expiry, Number(run.allocated_at))
  const expected = ['packet.json', 'run.json']
  const requestIds = new Set<string>()
  const times: number[] = []
  let committed = 0
  let generations = 0
  let fixedJudges = 0

  const returned = async (
    id: string,
    phase: 'generation' | 'judgement',
    fixedRequest: unknown,
    generated?: {
      result: Record<string, unknown>
      parent: Record<string, unknown>
    }
  ) => {
    if (!/^[a-zA-Z0-9-]+$/.test(id) || expected.includes(`${id}.dispatch.json`))
      throw new Error(INVALID)
    expected.push(`${id}.dispatch.json`, `${id}.result.json`)
    const dispatch = await readJson(`${directory}/${id}.dispatch.json`)
    const response = await readJson(`${directory}/${id}.result.json`)
    const request = record(dispatch.request)
    const model =
      phase === 'generation'
        ? profile.generation_model
        : profile.judgement_model
    if (
      dispatch.row_id !== id ||
      dispatch.phase !== phase ||
      dispatch.packet_sha256 !== saved.packet_sha256 ||
      dispatch.reserved_nanousd !== RESERVE_NANOUSD ||
      typeof dispatch.dispatched_at !== 'number' ||
      dispatch.dispatched_at < (times.at(-1) ?? Number(run.allocated_at)) ||
      request.phase !== phase ||
      request.model !== model ||
      typeof request.body !== 'string'
    )
      throw new Error(INVALID)
    checkDeadline(authority, expiry, dispatch.dispatched_at)
    times.push(dispatch.dispatched_at)
    equal(
      request.input_sha256,
      await sha256(
        canonicalizeJson({
          provider: 'gemini',
          model,
          body: request.body,
        })
      ),
      INVALID
    )
    if (!generated) equal(request, fixedRequest, INVALID)
    else {
      const body = record(JSON.parse(request.body))
      const contents = body.contents as { parts: { text: string }[] }[]
      const payload = record(JSON.parse(contents[0].parts[0].text))
      const input = record(payload.creation_input)
      equal(
        request.grant_input_sha256,
        await sha256(canonicalizeJson(input)),
        INVALID
      )
      equal(input.candidate, generated.result.content, INVALID)
      equal(
        input.content_sha256,
        await sha256(canonicalizeJson(input.candidate)),
        INVALID
      )
      equal(
        input.result_sha256,
        await sha256(canonicalizeJson(generated.result)),
        INVALID
      )
      equal(
        input.generation_input_sha256,
        record(generated.parent.grant).input_sha256,
        INVALID
      )
      for (const key of ['policy_sha256', 'prompt_sha256', 'validator_version'])
        equal(input[key], profile[key], INVALID)
      const anchor = record(record(record(generated.parent.grant).input).anchor)
      equal(
        input.anchor,
        {
          anchor_sha256: anchor.anchor_sha256,
          gloss: anchor.gloss,
          examples: anchor.examples,
        },
        INVALID
      )
    }
    const result = record(response.result)
    const provider = record(result.provider_response)
    equal(
      await sha256(canonicalizeJson(result)),
      response.result_sha256,
      INVALID
    )
    equal(journalPacket(canonicalizeJson(provider)), result, INVALID)
    if (
      typeof response.request_id !== 'string' ||
      !response.request_id ||
      response.request_id !== provider.responseId ||
      requestIds.has(response.request_id)
    )
      throw new Error(INVALID)
    requestIds.add(response.request_id)
    committed += reportedCharge(
      result,
      String(
        phase === 'generation'
          ? profile.generation_model_version
          : profile.judgement_model_version
      )
    )
    return result
  }
  for (const value of packet.requests) {
    const row = record(value)
    if (row.phase !== 'generation' && row.phase !== 'judgement')
      throw new Error(INVALID)
    const result = await returned(String(row.id), row.phase, row.request)
    if (row.phase === 'generation') {
      generations++
      await returned(`${row.id}-judge`, 'judgement', null, {
        result,
        parent: row,
      })
    } else fixedJudges++
  }
  if (
    generations !== 4 ||
    fixedJudges !== 40 ||
    requestIds.size !== 48 ||
    times.some(t => times.filter(s => s >= t && s < t + 60000).length > 10)
  )
    throw new Error(INVALID)
  const seal = await readJson(`${directory}/seal.json`)
  equal(
    seal,
    {
      packet_sha256: saved.packet_sha256,
      receipts_sha256: Object.fromEntries(
        expected.map(name => [name, hashes[name]])
      ),
    },
    INVALID
  )
  expected.push('seal.json', 'report.json')
  equal(Object.keys(hashes).sort(), [...expected].sort(), INVALID)
  const actual: string[] = []
  for await (const file of Deno.readDir(directory)) {
    if (!file.isFile) throw new Error(INVALID)
    actual.push(file.name)
  }
  equal(actual.sort(), expected.sort(), INVALID)
  const report = await readJson(`${directory}/report.json`)
  equal(report.complete, true, INVALID)
  equal(report.provider_results, 48, INVALID)
  equal(report.packet_sha256, saved.packet_sha256, INVALID)
  equal(report.qualified, false, INVALID)
  equal(report.committed_nanousd, committed, 'day-settlement-charge-conflict')
  return committed
}
