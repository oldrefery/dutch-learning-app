import { dirname, join } from 'node:path'
import {
  canonicalizeJson,
  parseDictionaryContent,
} from '../../packages/domain/src/shared-dictionary.ts'
import { journalPacket } from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
import { inspectCandidate } from '../../supabase/functions/dictionary-analysis/candidateGuards.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { buildSemanticPolicy } from '../../supabase/functions/dictionary-analysis/semanticModel.ts'
import {
  scoreJudge,
  summarizeQualification,
  type QualificationRequest,
} from './semantic-qualification.ts'
import type { QualificationCase } from './semantic-qualification-corpus.ts'
import { writeOnce } from './semantic-qualification-cli.ts'

async function verifyReceipts(hashes: Record<string, unknown>) {
  for (const [path, expected] of Object.entries(hashes))
    if (
      typeof expected !== 'string' ||
      (await sha256(await Deno.readTextFile(path))) !== expected
    )
      throw new Error(`Retained evidence changed: ${path}`)
}
async function readPilot(manifestPath: string) {
  const manifest = record(JSON.parse(await Deno.readTextFile(manifestPath)))
  const hashes = record(manifest.provider_receipts_sha256)
  if (!Object.keys(hashes).length)
    throw new Error('No immutable provider receipts')
  await verifyReceipts(hashes)
  const pilot = record(record(manifest.fresh_checks).provider_pilot)
  if (typeof pilot.strict_report !== 'string')
    throw new Error('Missing pilot report')
  const directory = dirname(pilot.strict_report)
  const saved = record(
    JSON.parse(await Deno.readTextFile(join(directory, 'packet.json')))
  )
  const packet = record(saved.packet)
  if (
    (await sha256(canonicalizeJson(packet))) !== pilot.packet_sha256 ||
    saved.packet_sha256 !== pilot.packet_sha256
  )
    throw new Error('Original packet hash changed')
  if (
    !Array.isArray(packet.requests) ||
    !Array.isArray(packet.corpus) ||
    typeof packet.model !== 'string'
  )
    throw new Error('Invalid retained packet')
  return {
    hashes,
    directory,
    saved,
    packet: {
      requests: packet.requests as QualificationRequest[],
      corpus: packet.corpus as QualificationCase[],
      model: packet.model,
    },
  }
}
async function reparseReceipt(path: string) {
  const result = record(
    record(JSON.parse(await Deno.readTextFile(path))).result
  )
  const envelope = record(result.provider_response)
  if (typeof envelope.modelVersion !== 'string')
    throw new Error('Missing observed model version')
  const reparsed = journalPacket(canonicalizeJson(envelope))
  if (
    canonicalizeJson(reparsed.provider_response) !== canonicalizeJson(envelope)
  )
    throw new Error('Replay changed provider envelope')
  return { result, reparsed, version: envelope.modelVersion }
}
export async function replayQualification(manifestPath: string) {
  const { hashes, directory, saved, packet } = await readPilot(manifestPath)
  const rows = [],
    generated = []
  const versions = new Set<string>()
  for (const request of packet.requests as QualificationRequest[]) {
    const path = join(directory, `${request.id}.result.json`)
    if (!Object.hasOwn(hashes, path))
      throw new Error('Unsealed provider result')
    const { result, reparsed, version } = await reparseReceipt(path)
    versions.add(version)
    if (request.kind === 'generation') {
      const inspected = await inspectCandidate(
        { ...request.context, result: reparsed },
        []
      )
      const schema = parseDictionaryContent(reparsed.content)
      generated.push({
        id: request.id,
        original_content_null: result.content === null,
        guard_valid: inspected.valid,
        issues: schema.success ? [] : schema.issues,
        decision_code: inspected.valid ? null : inspected.decision_code,
        semantic_judge_called: false,
      })
      continue
    }
    const candidate = await inspectCandidate(request.context, [])
    if (!candidate.valid)
      throw new Error('Frozen judge candidate failed guards')
    const item = (packet.corpus as QualificationCase[]).find(
      row => row.id === request.case_id
    )
    if (!item) throw new Error('Retained corpus case missing')
    rows.push({
      id: request.id,
      category: item.category,
      expected: item.expected,
      original_content_null: result.content === null,
      ...scoreJudge(request, reparsed, candidate.content_sha256, packet.model),
    })
  }
  await verifyReceipts(hashes)
  return {
    ...summarizeQualification(
      rows,
      packet.requests.filter(row => row.kind === 'judge').length
    ),
    mode: 'offline-replay',
    new_provider_calls: 0,
    original_packet_sha256: saved.packet_sha256,
    provider_envelopes_preserved: true,
    immutable_files_verified: Object.keys(hashes).length,
    replayed_responses: rows.length + generated.length,
    observed_model_versions: [...versions],
    current_candidate_policy: await buildSemanticPolicy(
      packet.model,
      [],
      packet.model,
      { generation: packet.model, judge: packet.model }
    ),
    new_request_schemas_exercised_by_provider: false,
    limitation:
      'Replays old responses through the corrected parser; does not measure generation under the new prompts/schema/policy.',
    rows,
    generated,
  }
}
if (import.meta.main) {
  const [manifest, output] = Deno.args
  if (!manifest || !output || Deno.args.length !== 2)
    throw new Error(
      'Usage: <immutable-pilot-manifest.json> <new-replay-report.json>'
    )
  const report = await replayQualification(manifest)
  await writeOnce(output, report)
  console.log(
    JSON.stringify({
      replayed: report.replayed_responses,
      invalid: report.invalid_verdicts,
      new_provider_calls: 0,
      qualified: false,
    })
  )
}
