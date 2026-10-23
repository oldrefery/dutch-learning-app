import {
  parseDictionaryCreationCommandV2,
  parseDictionaryCreationResponseV2,
  type DictionaryCreationCommandV2,
  type DictionaryCreationReceiptV2,
} from '../../../packages/domain/src/dictionary-creation.ts'
import { canonicalizeJson } from '../../../packages/domain/src/shared-dictionary.ts'
import {
  parseProtectedAnalysisInput,
  record,
  sha256,
} from '../dictionary-analysis/protectedInput.ts'

export type CreationCommand = DictionaryCreationCommandV2 & {
  recovery_id?: string
}
export type CreationPhase = 'generation' | 'judgement'
export interface CreationProfile {
  generation_model: string
  judgement_model: string
  prompt_sha256: string
  validator_version: string
  policy_sha256: string
}
export interface CreationGrant {
  run_id: string
  fence: string
  provider: 'gemini'
  model: string
  input: Record<string, unknown>
  input_sha256: string
  prompt_sha256?: string
}
export const uuid = (value: unknown): string => {
  if (
    typeof value !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  )
    throw new Error('invalid-creation-worker-contract')
  return value.toLowerCase()
}
const exact = (row: Record<string, unknown>, fields: string[]) => {
  if (
    Object.keys(row).length !== fields.length ||
    fields.some(key => !Object.hasOwn(row, key))
  )
    throw new Error('invalid-creation-worker-contract')
}
const digest = (value: unknown): string => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value))
    throw new Error('invalid-creation-worker-contract')
  return value
}
export const parseCreationCommand = (value: unknown): CreationCommand => {
  const row = record(value)
  if (!Object.hasOwn(row, 'recovery_id')) {
    const parsed = parseDictionaryCreationCommandV2(row)
    if (!parsed.success) throw new Error('invalid-creation-command')
    return parsed.data
  }
  exact(row, [
    'protocol_version',
    'operation_id',
    'resolution_id',
    'recovery_id',
  ])
  const { recovery_id, ...normal } = row
  const parsed = parseDictionaryCreationCommandV2(normal)
  const id = uuid(recovery_id)
  if (
    !parsed.success ||
    [parsed.data.operation_id, parsed.data.resolution_id].includes(id)
  )
    throw new Error('invalid-creation-command')
  return { ...parsed.data, recovery_id: id }
}
export const creationResponse = (
  value: unknown,
  command: DictionaryCreationCommandV2
) => {
  const parsed = parseDictionaryCreationResponseV2(value)
  if (
    !parsed.success ||
    parsed.data.operation_id !== command.operation_id ||
    parsed.data.resolution_id !== command.resolution_id
  )
    throw new Error('invalid-creation-worker-contract')
  if (
    'entry_id' in command &&
    ('outcome' in parsed.data ||
      parsed.data.entry_id !== command.entry_id ||
      parsed.data.fence !== (command as DictionaryCreationReceiptV2).fence)
  )
    throw new Error('invalid-creation-worker-contract')
  return parsed.data
}
export const creationReceipt = (
  value: unknown,
  command: DictionaryCreationCommandV2
) => {
  const result = creationResponse(value, command)
  if ('outcome' in result) throw new Error('invalid-creation-worker-contract')
  return result
}
export const validateCreationProfile = (profile: CreationProfile) => {
  if (
    ![profile.generation_model, profile.judgement_model].every(model =>
      /^gemini-[a-z0-9][a-z0-9.-]{0,100}$/.test(model)
    ) ||
    profile.generation_model === profile.judgement_model ||
    !profile.validator_version.trim() ||
    profile.validator_version.length > 200
  )
    throw new Error('invalid-creation-profile')
  digest(profile.prompt_sha256)
  digest(profile.policy_sha256)
}
export const parseCreationGrant = async (
  value: unknown,
  phase: CreationPhase,
  run: string,
  receipt: DictionaryCreationReceiptV2,
  profile: CreationProfile
): Promise<CreationGrant> => {
  validateCreationProfile(profile)
  const row = record(value)
  exact(row, [
    'run_id',
    'fence',
    'provider',
    'model',
    'input',
    'input_sha256',
    ...(phase === 'judgement' ? ['prompt_sha256'] : []),
  ])
  const input = record(row.input)
  if (
    uuid(row.run_id) !== run ||
    row.fence !== receipt.fence ||
    row.provider !== 'gemini' ||
    row.model !==
      (phase === 'generation'
        ? profile.generation_model
        : profile.judgement_model) ||
    input.schema_version !== 1 ||
    input.validator_version !== profile.validator_version ||
    input.policy_sha256 !== profile.policy_sha256 ||
    digest(row.input_sha256) !== (await sha256(canonicalizeJson(input)))
  )
    throw new Error('invalid-creation-dispatch-grant')
  digest(input.evidence_sha256)
  if (phase === 'generation') {
    exact(input, [
      'schema_version',
      'identity',
      'anchor',
      'evidence_sha256',
      'validator_version',
      'policy_sha256',
    ])
    exact(record(input.identity), [
      'language_code',
      'lemma',
      'part_of_speech',
      'article',
      'sense_key',
    ])
    parseProtectedAnalysisInput({
      entry: { ...record(input.identity), entry_id: receipt.entry_id },
      anchor: input.anchor,
    })
  } else {
    exact(input, [
      'schema_version',
      'anchor',
      'candidate',
      'content_sha256',
      'result_sha256',
      'generation_input_sha256',
      'fence',
      'evidence_sha256',
      'validator_version',
      'policy_sha256',
      'prompt_sha256',
    ])
    const anchor = record(input.anchor)
    exact(anchor, ['anchor_sha256', 'gloss', 'examples'])
    if (
      row.prompt_sha256 !== profile.prompt_sha256 ||
      input.prompt_sha256 !== profile.prompt_sha256 ||
      input.fence !== receipt.fence ||
      input.result_sha256 !== receipt.result_sha256 ||
      typeof anchor.gloss !== 'string' ||
      !anchor.gloss.trim() ||
      anchor.gloss.length > 4000 ||
      !Array.isArray(anchor.examples) ||
      anchor.examples.length < 1 ||
      anchor.examples.length > 20 ||
      !anchor.examples.every(
        example =>
          typeof example === 'string' &&
          !!example.trim() &&
          example.length <= 4000
      ) ||
      digest(input.content_sha256) !==
        (await sha256(canonicalizeJson(record(input.candidate))))
    )
      throw new Error('invalid-creation-dispatch-grant')
    digest(anchor.anchor_sha256)
    digest(input.result_sha256)
    digest(input.generation_input_sha256)
  }
  return {
    run_id: run,
    fence: receipt.fence,
    provider: 'gemini',
    model: row.model as string,
    input,
    input_sha256: row.input_sha256 as string,
    ...(phase === 'judgement' ? { prompt_sha256: profile.prompt_sha256 } : {}),
  }
}
