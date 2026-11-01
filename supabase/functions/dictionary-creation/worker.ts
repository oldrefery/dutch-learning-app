import type { DictionaryCreationResponseV2 } from '../../../packages/domain/src/dictionary-creation.ts'
import type { ProviderOutcome } from '../dictionary-analysis/geminiTransport.ts'
import { record } from '../dictionary-analysis/protectedInput.ts'
import {
  creationResponse,
  creationReceipt,
  parseCreationGrant,
  uuid,
  validateCreationProfile,
  type CreationCommand,
  type CreationGrant,
  type CreationPhase,
  type CreationProfile,
} from './contracts.ts'

export interface CreationStore {
  accept(command: CreationCommand): Promise<unknown>
  read(actor: string, operation: string): Promise<unknown>
  dispatch(phase: CreationPhase, run: string, fence: string): Promise<unknown>
  journal(
    phase: CreationPhase,
    grant: CreationGrant,
    result: Record<string, unknown>,
    requestId: string
  ): Promise<unknown>
  failure(
    phase: CreationPhase,
    grant: CreationGrant,
    known: boolean,
    evidence: string | null
  ): Promise<unknown>
  validate(run: string, fence: string): Promise<unknown>
  publish(run: string, fence: string, validation: string): Promise<unknown>
}
export interface CreationTransport {
  // Only a committed RPC grant may reach a qualified transport. No default provider.
  invoke(
    phase: CreationPhase,
    grant: CreationGrant,
    actor?: string
  ): Promise<ProviderOutcome>
}
export interface CreationWorkerDependencies {
  store: CreationStore
  transport: CreationTransport
  profile: CreationProfile
  verifyActor(): Promise<string | null>
}
export class CreationAuthenticationError extends Error {}
export class CreationCandidateInvalid extends Error {}

export const runDictionaryCreation = async (
  actor: string,
  command: CreationCommand,
  dependencies: CreationWorkerDependencies
): Promise<DictionaryCreationResponseV2> => {
  const { store } = dependencies
  const authorize = async () => {
    if ((await dependencies.verifyActor()) !== actor)
      throw new CreationAuthenticationError('authentication-required')
  }
  await authorize()
  const accepted = creationResponse(await store.accept(command), command)
  if (
    'outcome' in accepted ||
    !['accepted', 'dispatching', 'validating'].includes(accepted.status)
  )
    return accepted
  validateCreationProfile(dependencies.profile)
  const work = record(await store.read(actor, command.operation_id))
  const run = uuid(work.run_id)
  let current = creationReceipt(work.receipt, accepted)
  const invoke = async (phase: CreationPhase, value: unknown) => {
    const grant = await parseCreationGrant(
      value,
      phase,
      run,
      current,
      dependencies.profile
    )
    await authorize()
    let response: ProviderOutcome
    try {
      response = await dependencies.transport.invoke(phase, grant)
    } catch {
      // A local exception is not evidence that a paid request did not execute.
      response = { kind: 'provider-outcome-unknown', evidence_sha256: null }
    }
    if (response.kind !== 'returned')
      return creationReceipt(
        await store.failure(
          phase,
          grant,
          response.kind === 'provider-failed',
          response.evidence_sha256
        ),
        current
      )
    // A lost journal reply must not become failure evidence or cause redispatch.
    return creationReceipt(
      await store.journal(phase, grant, response.result, response.requestId),
      current
    )
  }
  if (['accepted', 'dispatching'].includes(current.status)) {
    await authorize()
    const result = record(
      await store.dispatch('generation', run, current.fence)
    )
    current = creationReceipt(result.receipt, current)
    if (result.dispatch !== null) {
      if (current.status !== 'dispatching')
        throw new Error('invalid-creation-dispatch-grant')
      current = await invoke('generation', result.dispatch)
    }
  }
  if (current.status !== 'validating') return current
  await authorize()
  let judgement: Record<string, unknown>
  try {
    judgement = record(await store.dispatch('judgement', run, current.fence))
  } catch (error) {
    if (!(error instanceof CreationCandidateInvalid)) throw error
    // SQL validates schema/lexical identity/media before charging a judge. Persist
    // its derived rejection; never turn an arbitrary storage error into rejection.
    await authorize()
    const rejected = record(await store.validate(run, current.fence))
    const receipt = creationReceipt(rejected.receipt, current)
    if (
      !['rejected', 'review-required'].includes(rejected.outcome as string) ||
      receipt.status !== rejected.outcome
    )
      throw new Error('invalid-creation-validation')
    return receipt
  }
  current = creationReceipt(judgement.receipt, current)
  if (current.status !== 'validating') return current
  if (judgement.dispatch !== null)
    current = await invoke('judgement', judgement.dispatch)
  else {
    const attempt =
      judgement.attempt === null ? null : record(judgement.attempt)
    if (!attempt || attempt.status !== 'returned') return current
    if (uuid(attempt.run_id) !== run || attempt.quota_charged !== true)
      throw new Error('invalid-creation-worker-contract')
  }
  if (current.status !== 'validating') return current
  await authorize()
  const validation = record(await store.validate(run, current.fence))
  current = creationReceipt(validation.receipt, current)
  if (current.status !== 'validating') return current
  if (validation.outcome !== 'accepted')
    throw new Error('invalid-creation-validation')
  await authorize()
  return creationReceipt(
    await store.publish(run, current.fence, uuid(validation.validation_id)),
    current
  )
}
