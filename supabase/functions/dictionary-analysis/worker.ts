import {
  parseDictionaryAnalysisAcceptanceV2,
  parseDictionaryAnalysisReceiptV2,
  type DictionaryAnalysisCommandV2,
  type DictionaryAnalysisReceiptV2,
  type DictionaryAnalysisAcceptanceV2,
} from '../../../packages/domain/src/dictionary-analysis.ts'
import {
  parseDictionaryAnalysisValidationV1,
  type DictionaryAnalysisValidationV1,
} from '../../../packages/domain/src/dictionary-publication.ts'
import { canonicalizeJson } from '../../../packages/domain/src/shared-dictionary.ts'
import {
  parseProtectedAnalysisInput,
  prepareGeminiRequest,
  record,
  type ProtectedAnalysisInput,
} from './protectedInput.ts'
import type { GeminiTransport } from './geminiTransport.ts'
import type { SemanticEvaluation } from './independentEvaluator.ts'

export interface AnalysisStore {
  accept(command: DictionaryAnalysisCommandV2): Promise<unknown>
  read(actor: string, operation: string, fence: string): Promise<unknown>
  dispatch(
    actor: string,
    operation: string,
    fence: string,
    model: string,
    hash: string
  ): Promise<unknown>
  journal(
    actor: string,
    operation: string,
    fence: string,
    result: Record<string, unknown>,
    requestId: string
  ): Promise<unknown>
  failure(
    actor: string,
    operation: string,
    fence: string,
    outcome: string,
    evidence: string | null
  ): Promise<unknown>
  validate(
    actor: string,
    operation: string,
    fence: string,
    validation: DictionaryAnalysisValidationV1
  ): Promise<unknown>
  publish(
    actor: string,
    operation: string,
    fence: string,
    validationId: string
  ): Promise<unknown>
}
export interface EvaluationContext {
  receipt: DictionaryAnalysisReceiptV2
  input: ProtectedAnalysisInput
  input_sha256: string
  result: Record<string, unknown>
}
export interface AnalysisWorkerDependencies {
  store: AnalysisStore
  transport: GeminiTransport
  model: string
  // A separately qualified trusted evaluator is required. The provider response
  // is not a semantic verdict; no default evaluator/policy is silently enabled.
  evaluate(
    context: EvaluationContext,
    verifiedActor: string
  ): Promise<SemanticEvaluation>
}
const parseReceipt = (
  value: unknown,
  command: DictionaryAnalysisCommandV2
): DictionaryAnalysisReceiptV2 => {
  const parsed = parseDictionaryAnalysisReceiptV2(value)
  if (
    !parsed.success ||
    parsed.data.operation_id !== command.operation_id ||
    parsed.data.entry_id !== command.entry_id ||
    parsed.data.expected_revision_id !== command.expected_revision_id ||
    parsed.data.expected_head_sequence !== command.expected_head_sequence ||
    ('fence' in command && parsed.data.fence !== command.fence)
  )
    throw new Error('invalid-worker-receipt')
  return parsed.data
}
const sha = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
    throw new Error('invalid-worker-contract')
  return value
}
const validationId = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    throw new Error('invalid-worker-contract')
  return value
}
const readWork = async (
  actor: string,
  receipt: DictionaryAnalysisReceiptV2,
  store: AnalysisStore
) => {
  const work = record(
    await store.read(actor, receipt.operation_id, receipt.fence)
  )
  const current = parseReceipt(work.receipt, receipt)
  if (current.fence !== receipt.fence)
    throw new Error('invalid-worker-contract')
  const input = parseProtectedAnalysisInput(work.payload)
  if (input.entry.entry_id !== receipt.entry_id)
    throw new Error('invalid-worker-contract')
  return { work, current, input }
}

const finishJournaledResult = async (
  actor: string,
  receipt: DictionaryAnalysisReceiptV2,
  dependencies: AnalysisWorkerDependencies
): Promise<DictionaryAnalysisReceiptV2> => {
  const { work, current, input } = await readWork(
    actor,
    receipt,
    dependencies.store
  )
  if (current.status !== 'validating') return current
  let id: string
  if (work.validation_id !== null) {
    id = validationId(work.validation_id)
  } else {
    const inputHash = sha(work.input_sha256)
    const verdict = await dependencies.evaluate(
      {
        receipt: current,
        input,
        input_sha256: inputHash,
        result: record(work.result),
      },
      actor
    )
    if ('kind' in verdict) return parseReceipt(verdict.receipt, current)
    const parsed = parseDictionaryAnalysisValidationV1(verdict)
    if (
      !parsed.success ||
      parsed.data.anchor_sha256 !== input.anchor.anchor_sha256 ||
      parsed.data.input_sha256 !== inputHash ||
      parsed.data.result_sha256 !== current.result_sha256
    )
      throw new Error('invalid-evaluation-evidence')
    const response = record(
      await dependencies.store.validate(
        actor,
        current.operation_id,
        current.fence,
        parsed.data
      )
    )
    const after = parseReceipt(response.receipt, current)
    if (after.status !== 'validating') return after
    if (response.outcome !== 'accepted')
      throw new Error('invalid-worker-contract')
    id = validationId(response.validation_id)
  }
  return parseReceipt(
    await dependencies.store.publish(
      actor,
      current.operation_id,
      current.fence,
      id
    ),
    current
  )
}

export const runDictionaryAnalysis = async (
  verifiedActor: string,
  command: DictionaryAnalysisCommandV2,
  dependencies: AnalysisWorkerDependencies
): Promise<DictionaryAnalysisAcceptanceV2> => {
  const accepted = parseDictionaryAnalysisAcceptanceV2(
    await dependencies.store.accept(command)
  )
  if (!accepted.success) throw new Error('invalid-worker-contract')
  if ('outcome' in accepted.data) return accepted.data
  let receipt = parseReceipt(accepted.data, command)
  if (receipt.status === 'validating')
    return finishJournaledResult(verifiedActor, receipt, dependencies)
  if (!['accepted', 'dispatching'].includes(receipt.status)) return receipt

  const { work, current, input } = await readWork(
    verifiedActor,
    receipt,
    dependencies.store
  )
  receipt = current
  if (receipt.status === 'validating')
    return finishJournaledResult(verifiedActor, receipt, dependencies)
  if (!['accepted', 'dispatching'].includes(receipt.status)) return receipt
  // Use persisted metadata for a dispatching replay, even if worker configuration
  // changed. The RPC can expire/quarantine it, but can never return another grant.
  const request =
    receipt.status === 'accepted'
      ? await prepareGeminiRequest(input, dependencies.model)
      : null
  const model = request?.model ?? work.model
  const hash = request?.input_sha256 ?? work.input_sha256
  if (
    typeof model !== 'string' ||
    (work.provider !== null && work.provider !== 'gemini')
  )
    throw new Error('invalid-worker-contract')
  const grant = record(
    await dependencies.store.dispatch(
      verifiedActor,
      receipt.operation_id,
      receipt.fence,
      model,
      sha(hash)
    )
  )
  receipt = parseReceipt(grant.receipt, receipt)
  if (grant.dispatch === null)
    return receipt.status === 'validating'
      ? finishJournaledResult(verifiedActor, receipt, dependencies)
      : receipt
  if (
    !request ||
    receipt.status !== 'dispatching' ||
    canonicalizeJson(parseProtectedAnalysisInput(grant.dispatch)) !==
      canonicalizeJson(input)
  )
    throw new Error('invalid-dispatch-grant')

  const response = await dependencies.transport.invoke(
    request,
    `${receipt.operation_id}:${receipt.fence}`
  )
  if (response.kind !== 'returned')
    return parseReceipt(
      await dependencies.store.failure(
        verifiedActor,
        receipt.operation_id,
        receipt.fence,
        response.kind,
        response.evidence_sha256
      ),
      receipt
    )
  // If this reply is lost, the next invocation reads the database. Never interpret
  // a journal error as proof the result was not committed or repeat the provider.
  receipt = parseReceipt(
    await dependencies.store.journal(
      verifiedActor,
      receipt.operation_id,
      receipt.fence,
      response.result,
      response.requestId
    ),
    receipt
  )
  return receipt.status === 'validating'
    ? finishJournaledResult(verifiedActor, receipt, dependencies)
    : receipt
}
