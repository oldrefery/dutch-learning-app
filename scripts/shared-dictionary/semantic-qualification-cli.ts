import { canonicalizeJson } from '../../packages/domain/src/shared-dictionary.ts'
import {
  createGeminiTransport,
  type GeminiTransport,
} from '../../supabase/functions/dictionary-analysis/geminiTransport.ts'
import { inspectCandidate } from '../../supabase/functions/dictionary-analysis/candidateGuards.ts'
import {
  record,
  sha256,
} from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import {
  generatedJudge,
  MODEL,
  prepareQualification,
  scoreJudge,
  summarizeQualification,
  type QualificationRequest,
} from './semantic-qualification.ts'

const SOURCES = [
  'scripts/shared-dictionary/semantic-qualification.ts',
  'scripts/shared-dictionary/semantic-qualification-corpus.ts',
  'scripts/shared-dictionary/semantic-qualification-expanded.ts',
  'scripts/shared-dictionary/semantic-qualification-cli.ts',
  'supabase/functions/dictionary-analysis/protectedInput.ts',
  'supabase/functions/dictionary-analysis/responseSchemas.ts',
  'supabase/functions/dictionary-analysis/semanticModel.ts',
  'supabase/functions/dictionary-analysis/observedModel.ts',
  'supabase/functions/dictionary-analysis/independentEvaluator.ts',
  'supabase/functions/dictionary-analysis/endpoint.ts',
  'supabase/functions/dictionary-analysis/runtime.ts',
  'supabase/functions/dictionary-analysis/candidateGuards.ts',
  'supabase/functions/dictionary-analysis/geminiTransport.ts',
  'supabase/functions/dictionary-analysis/providerDiagnostics.ts',
  'packages/domain/src/shared-dictionary.ts',
  'supabase/functions/dictionary-creation/worker.ts',
  'supabase/migrations/20261011220000_bind_dictionary_observed_model_versions.sql',
]
export async function frozenPacket() {
  const source_sha256: Record<string, string> = {}
  for (const path of SOURCES)
    source_sha256[path] = await sha256(await Deno.readTextFile(path))
  const packet = { ...(await prepareQualification()), source_sha256 }
  return { packet, packet_sha256: await sha256(canonicalizeJson(packet)) }
}
export async function writeOnce(path: string, value: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n')
  const file = await Deno.open(path, {
    write: true,
    createNew: true,
    mode: 0o600,
  })
  try {
    let offset = 0
    while (offset < bytes.length)
      offset += await file.write(bytes.subarray(offset))
    await file.sync()
  } finally {
    file.close()
  }
}
async function readOptional(
  path: string
): Promise<Record<string, unknown> | null> {
  try {
    return record(JSON.parse(await Deno.readTextFile(path)))
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) return null
    throw error
  }
}
export function validateUsage(result: Record<string, unknown>): string {
  const envelope = record(result.provider_response)
  const version = envelope.modelVersion
  if (typeof version !== 'string' || version !== MODEL)
    throw new Error(
      'Missing or unexpected provider model version; stop for review'
    )
  const usage = record(envelope.usageMetadata)
  if (
    !Number.isSafeInteger(usage.promptTokenCount) ||
    !Number.isSafeInteger(usage.totalTokenCount) ||
    Number(usage.promptTokenCount) < 0 ||
    Number(usage.promptTokenCount) > 32768 ||
    Number(usage.totalTokenCount) < Number(usage.promptTokenCount) ||
    Number(usage.totalTokenCount) - Number(usage.promptTokenCount) > 65536
  )
    throw new Error(
      'Missing or out-of-bound provider token accounting; stop for review'
    )
  return version
}
// Exact packet hash is an execution guard, not a substitute for user authorization.
const productionTransport = (): GeminiTransport => {
  const apiKey = Deno.env.get('DICTIONARY_ANALYSIS_GEMINI_API_KEY')
  if (!apiKey) throw new Error('Qualification API key unavailable')
  return createGeminiTransport({ apiKey, fetch })
}
type Packet = Awaited<ReturnType<typeof frozenPacket>>
type Invoke = (row: QualificationRequest) => Promise<Record<string, unknown>>
async function retainExact(path: string, value: unknown) {
  const prior = await readOptional(path)
  if (!prior) return writeOnce(path, value)
  if (canonicalizeJson(prior) !== canonicalizeJson(value))
    throw new Error('Retained evidence differs')
}
async function readDispatches(output: string) {
  const dispatches: number[] = []
  for await (const entry of Deno.readDir(output)) {
    if (!entry.name.endsWith('.dispatch.json')) continue
    const intent = await readOptional(`${output}/${entry.name}`)
    const timestamp = intent?.dispatched_at
    if (typeof timestamp !== 'number' || !Number.isFinite(timestamp))
      throw new Error('Invalid retained dispatch')
    dispatches.push(timestamp)
  }
  return dispatches
}
function journalledInvoker(
  current: Packet,
  output: string,
  transport: GeminiTransport,
  dispatches: number[],
  now: () => number
): Invoke {
  return async row => {
    const path = `${output}/${row.id}`
    const prior = await readOptional(`${path}.result.json`)
    const sent = await readOptional(`${path}.dispatch.json`)
    if (prior) {
      if (!sent || sent.request_sha256 !== row.request.input_sha256)
        throw new Error('Retained request conflict')
      return record(prior.result)
    }
    if (sent)
      throw new Error(
        'Previously dispatched request has no result; reconcile without redispatch'
      )
    if (
      dispatches.length >= current.packet.limits.provider_calls ||
      (dispatches.length + 1) * 0.28 > 15
    )
      throw new Error('Qualification attempt budget exhausted')
    if (new TextEncoder().encode(row.request.body).length > 32768)
      throw new Error('Request exceeds reserved input budget')
    const recent = dispatches
      .filter(at => now() - at < 61000)
      .sort((a, b) => a - b)
    if (recent.length >= 10)
      await new Promise(resolve =>
        setTimeout(resolve, Math.max(0, 61000 - (now() - recent[0])))
      )
    if (now() >= Date.parse(current.packet.limits.approval_expires_at))
      throw new Error('Approval expired during run')
    const at = now()
    await writeOnce(`${path}.dispatch.json`, {
      request_sha256: row.request.input_sha256,
      dispatched_at: at,
      reserved_usd: 0.28,
    })
    dispatches.push(at)
    const outcome = await transport.invoke(row.request, row.id)
    if (outcome.kind !== 'returned') {
      await writeOnce(`${path}.failure.json`, outcome)
      throw new Error(
        'Provider failure or unknown outcome; no retry authorized'
      )
    }
    await writeOnce(`${path}.result.json`, {
      result: outcome.result,
      request_id: outcome.requestId,
    })
    return outcome.result
  }
}
async function scoreRequest(
  row: QualificationRequest,
  result: Record<string, unknown>
) {
  const candidate = await inspectCandidate(row.context, [])
  if (!candidate.valid) throw new Error('Qualification candidate changed')
  return { id: row.id, ...scoreJudge(row, result, candidate.content_sha256) }
}
async function evaluateRequests(current: Packet, invoke: Invoke) {
  const versions = new Set<string>()
  const verifiedInvoke: Invoke = async row => {
    const result = await invoke(row)
    versions.add(validateUsage(result))
    if (versions.size !== 1)
      throw new Error('Provider version changed within run; stop for review')
    return result
  }
  const scores = [],
    generated = []
  for (const row of current.packet.requests) {
    const result = await verifiedInvoke(row)
    if (row.kind === 'generation') {
      const judge = await generatedJudge(row, result)
      generated.push(
        judge
          ? await scoreRequest(judge, await verifiedInvoke(judge))
          : { id: row.id, decision: 'guard-rejected' }
      )
    } else
      scores.push({
        ...(await scoreRequest(row, result)),
        category: current.packet.corpus.find(item => item.id === row.case_id)!
          .category,
      })
  }
  return {
    ...summarizeQualification(scores, current.packet.expected_judge_results),
    scores,
    generated,
  }
}
export async function runQualification(
  packetPath: string,
  output: string,
  approvedHash: string,
  transportFactory = productionTransport,
  now: () => number = Date.now
) {
  const saved = record(JSON.parse(await Deno.readTextFile(packetPath)))
  const current = await frozenPacket()
  if (
    approvedHash !== current.packet_sha256 ||
    canonicalizeJson(saved) !== canonicalizeJson(current)
  )
    throw new Error('Approval packet or source changed')
  if (now() >= Date.parse(current.packet.limits.approval_expires_at))
    throw new Error('Approval packet expired; refresh documentation and scope')
  await Deno.mkdir(output, { recursive: true, mode: 0o700 })
  const lock = await Deno.open(`${output}/run.lock`, {
    write: true,
    createNew: true,
    mode: 0o600,
  })
  try {
    await retainExact(`${output}/packet.json`, current)
    const dispatches = await readDispatches(output)
    // Credentials are read only after exact approval/source validation, never in prepare.
    const invoke = journalledInvoker(
      current,
      output,
      transportFactory(),
      dispatches,
      now
    )
    const report = {
      ...(await evaluateRequests(current, invoke)),
      execution_scope: current.packet.execution_scope,
      provider_attempts: dispatches.length,
      reserved_usd: dispatches.length * 0.28,
      packet_sha256: current.packet_sha256,
    }
    await retainExact(`${output}/report.json`, report)
    return report
  } finally {
    lock.close()
    await Deno.remove(`${output}/run.lock`)
  }
}
if (import.meta.main) {
  const [command, path, output, approval] = Deno.args
  if (command === 'prepare' && path && !output) {
    const packet = await frozenPacket()
    await writeOnce(path, packet)
    console.log(
      JSON.stringify({
        packet_sha256: packet.packet_sha256,
        cases: packet.packet.corpus.length,
        max_calls: packet.packet.limits.provider_calls,
        qualified: false,
      })
    )
  } else if (command === 'run' && path && output && approval) {
    const report = await runQualification(path, output, approval)
    console.log(
      JSON.stringify({
        completed_judge_results: report.completed_judge_results,
        provider_attempts: report.provider_attempts,
        qualified: false,
      })
    )
  } else
    throw new Error(
      'Usage: prepare <packet.json> | run <packet.json> <new-run-directory> <approved-packet-sha256>'
    )
}
