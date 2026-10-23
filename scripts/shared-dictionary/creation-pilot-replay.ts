import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import { resolve } from 'node:path'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { journalPacket } from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
import {
  creationJudgeRequest,
  scoreCreationJudge,
  type CreationQualificationRequest,
} from './creation-qualification.ts'
import { summarizeQualification } from './semantic-qualification.ts'
import {
  verifyCreationPilotPacket,
  type CreationPilotPacket,
} from './creation-pilot-packet.ts'
import { reportedCharge } from './creation-pilot-usage.ts'
import {
  readJson,
  optionalJson,
  digestFiles,
  equal,
  verifyRunBinding,
  checkDeadline,
} from './creation-pilot-journal.ts'

function score(
  row: CreationQualificationRequest,
  result: Record<string, unknown>,
  profile: Parameters<typeof scoreCreationJudge>[2]
) {
  const scored = scoreCreationJudge(row, result, profile)
  return {
    ...scored,
    model_version:
      typeof scored.model_version === 'string' ? scored.model_version : null,
  }
}

function passesThresholds(
  complete: boolean,
  summary: ReturnType<typeof summarizeQualification>,
  generated: { decision: string }[],
  t: CreationPilotPacket['packet']['thresholds']
) {
  return (
    complete &&
    summary.false_acceptances === 0 &&
    summary.invalid_verdicts === 0 &&
    summary.positive_acceptance >= t.minimum_positive_acceptance &&
    summary.negative_rejection >= t.minimum_negative_rejection &&
    summary.uncertain_abstention >= t.minimum_uncertain_abstention &&
    generated.every(g => g.decision === 'same-meaning')
  )
}

async function verifySeal(
  directory: string,
  packetHash: string,
  files: string[]
) {
  const seal = await readJson(`${directory}/seal.json`)
  equal(
    seal,
    {
      packet_sha256: packetHash,
      receipts_sha256: await digestFiles(directory, files),
    },
    'provider-evidence-seal-conflict'
  )
  const expected = new Set([...files, 'seal.json', 'report.json'])
  for await (const file of Deno.readDir(directory))
    if (!expected.has(file.name)) throw new Error('unexpected-run-evidence')
}

export async function replayCreationPilot(
  directory: string,
  requireSeal = true
) {
  const current = await verifyCreationPilotPacket(`${directory}/packet.json`)
  const p = current.packet,
    run = await readJson(`${directory}/run.json`)
  const authority = await verifyRunBinding(run)
  if (run.packet_sha256 !== current.packet_sha256)
    throw new Error('run-packet-conflict')
  equal(run.run_directory, resolve(directory), 'run-directory-conflict')
  checkDeadline(
    authority,
    p.limits.packet_valid_until,
    Number(run.allocated_at)
  )
  const files = ['packet.json', 'run.json'],
    scores = [],
    generated = []
  let results = 0,
    committed = 0,
    complete = true
  const readResult = async (row: CreationQualificationRequest) => {
    const dispatch = await optionalJson(`${directory}/${row.id}.dispatch.json`)
    const response = await optionalJson(`${directory}/${row.id}.result.json`)
    if (!dispatch || !response) {
      complete = false
      return null
    }
    if (typeof dispatch.dispatched_at !== 'number')
      throw new Error('invalid-dispatch-time')
    checkDeadline(
      authority,
      p.limits.packet_valid_until,
      dispatch.dispatched_at
    )
    equal(
      dispatch,
      {
        packet_sha256: current.packet_sha256,
        row_id: row.id,
        phase: row.phase,
        request: row.request,
        dispatched_at: dispatch.dispatched_at,
        reserved_nanousd: 280000000,
      },
      'dispatch-binding-conflict'
    )
    const result = record(response.result)
    if (
      response.result_sha256 !== (await sha256(canonicalizeJson(result))) ||
      typeof response.request_id !== 'string' ||
      !response.request_id
    )
      throw new Error('result-binding-conflict')
    equal(
      journalPacket(canonicalizeJson(result.provider_response)),
      result,
      'raw-provider-reparse-conflict'
    )
    const version =
      row.phase === 'generation'
        ? p.profile.generation_model_version
        : p.profile.judgement_model_version
    committed += reportedCharge(result, version)
    results++
    files.push(`${row.id}.dispatch.json`, `${row.id}.result.json`)
    return result
  }
  for (const row of p.requests) {
    const result = await readResult(row)
    if (!result) break
    if (row.phase === 'generation') {
      const judge = await creationJudgeRequest(row, result, p.profile)
      if (!judge) {
        complete = false
        break
      }
      const judged = await readResult(judge)
      if (!judged) break
      generated.push({
        id: row.id,
        judge_id: judge.id,
        ...score(judge, judged, p.profile),
      })
    } else {
      const item = p.corpus.find(c => c.id === row.case_id)!
      scores.push({
        id: row.id,
        category: item.category,
        ...score(row, result, p.profile),
      })
    }
  }
  complete =
    complete &&
    scores.length === 40 &&
    generated.length === 4 &&
    results === 48 &&
    p.guards.length === 2
  if (requireSeal) await verifySeal(directory, current.packet_sha256, files)
  const summary = summarizeQualification(scores, 40),
    t = p.thresholds
  return {
    ...summary,
    complete,
    packet_sha256: current.packet_sha256,
    execution_scope: p.execution_scope,
    provider_results: results,
    committed_nanousd: committed,
    scores,
    generated,
    thresholds_pass: passesThresholds(complete, summary, generated, t),
    qualified: false,
    provider_evidence_review_required: true,
    reconstruction_used_network: false,
  }
}
