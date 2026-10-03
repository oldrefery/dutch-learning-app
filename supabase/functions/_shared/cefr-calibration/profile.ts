import { REQUIRED_SLICES } from './fixture.ts'
import {
  count,
  list,
  nullableText,
  objectDigest,
  record,
  requireValid,
  text,
  unit,
} from './validation.ts'

export interface MethodProfile {
  namespace: 'dictionary-cefr-method-v1'
  input_schema_version: 1
  method_revision: string
  prompt_revision: string
  provider: string
  requested_model: string
  resolved_model_version: string | null
  generation_config: Record<string, unknown>
}

export const validateProfile = (value: unknown): MethodProfile => {
  const raw = record(value)
  const fields = [
    'namespace',
    'input_schema_version',
    'method_revision',
    'prompt_revision',
    'provider',
    'requested_model',
    'resolved_model_version',
    'generation_config',
  ]
  requireValid(
    Object.keys(raw).every(field => fields.includes(field)),
    'unsupported_method_setting'
  )
  requireValid(
    raw.namespace === 'dictionary-cefr-method-v1' &&
      raw.input_schema_version === 1,
    'method_namespace'
  )
  const config = record(raw.generation_config)
  requireValid(Object.keys(config).length > 0, 'generation_config_required')
  return {
    namespace: 'dictionary-cefr-method-v1',
    input_schema_version: 1,
    method_revision: text(raw.method_revision),
    prompt_revision: text(raw.prompt_revision),
    provider: text(raw.provider),
    requested_model: text(raw.requested_model),
    resolved_model_version: nullableText(raw.resolved_model_version),
    generation_config: structuredClone(config),
  }
}

export interface AcceptancePolicy {
  revision: string
  reviewer: string
  approval_ref: string
  confidence_threshold: number
  confidence_bins: number[]
  minimum_items_per_split: number
  minimum_items_per_slice: number
  minimum_scored_items: number
  minimum_accepted_items: number
  minimum_abstention_accuracy: number
  minimum_coverage: number
  minimum_exact: number
  minimum_within_one: number
  minimum_accepted_accuracy: number
  maximum_severe_error_rate: number
  required_slices: readonly string[]
}

// All thresholds are explicit reviewed inputs. There is no operational default.
export const validatePolicy = (value: unknown): AcceptancePolicy => {
  const raw = record(value)
  const bins = list(raw.confidence_bins).map(unit)
  requireValid(
    bins.length >= 2 &&
      bins[0] === 0 &&
      bins.at(-1) === 1 &&
      bins.every((bin, i) => i === 0 || bin > bins[i - 1]),
    'confidence_bins'
  )
  return {
    revision: text(raw.revision),
    reviewer: text(raw.reviewer),
    approval_ref: text(raw.approval_ref),
    confidence_threshold: unit(raw.confidence_threshold),
    confidence_bins: bins,
    minimum_items_per_split: count(raw.minimum_items_per_split),
    minimum_items_per_slice: count(raw.minimum_items_per_slice),
    minimum_scored_items: count(raw.minimum_scored_items),
    minimum_accepted_items: count(raw.minimum_accepted_items),
    minimum_abstention_accuracy: unit(raw.minimum_abstention_accuracy),
    minimum_coverage: unit(raw.minimum_coverage),
    minimum_exact: unit(raw.minimum_exact),
    minimum_within_one: unit(raw.minimum_within_one),
    minimum_accepted_accuracy: unit(raw.minimum_accepted_accuracy),
    maximum_severe_error_rate: unit(raw.maximum_severe_error_rate),
    required_slices: REQUIRED_SLICES,
  }
}

export const profileDigest = (value: unknown): Promise<string> =>
  objectDigest(validateProfile(value))
