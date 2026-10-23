import { record } from '../../supabase/functions/dictionary-analysis/protectedInput.ts'
import { matchesObservedModel } from '../../supabase/functions/dictionary-analysis/observedModel.ts'

export const RESERVE_NANOUSD = 280000000
export const DAY_LIMIT_NANOUSD = 15000000000
export function reportedCharge(
  result: Record<string, unknown>,
  expectedVersion: string
) {
  const provider = record(result.provider_response),
    usage = record(provider.usageMetadata)
  const prompt = usage.promptTokenCount,
    total = usage.totalTokenCount,
    cached =
      usage.cachedContentTokenCount === undefined
        ? 0
        : usage.cachedContentTokenCount
  if (
    !matchesObservedModel(result, expectedVersion) ||
    usage.serviceTier !== 'standard' ||
    !Number.isSafeInteger(prompt) ||
    !Number.isSafeInteger(total) ||
    Number(prompt) < 0 ||
    Number(prompt) > 32768 ||
    Number(total) < Number(prompt) ||
    Number(total) - Number(prompt) > 65536 ||
    !Number.isSafeInteger(cached) ||
    Number(cached) < 0 ||
    Number(cached) > Number(prompt) ||
    Number(usage.toolUsePromptTokenCount ?? 0) !== 0
  )
    throw new Error('unqualified-phase-version-or-token-accounting')
  // Standard text rates through 2026-12-31, in nanousd/token. Cached input is
  // already included in promptTokenCount; never charge it a second time.
  const charge =
    (Number(prompt) - Number(cached)) * 750 +
    Number(cached) * 75 +
    (Number(total) - Number(prompt)) * 3750
  if (charge > RESERVE_NANOUSD)
    throw new Error('reported-charge-exceeds-reservation')
  return charge
}
