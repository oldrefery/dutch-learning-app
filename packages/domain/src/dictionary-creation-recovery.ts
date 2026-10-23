import {
  parseDictionaryCreationCommandV2,
  type DictionaryCreationCommandV2,
} from './dictionary-creation'
import type { DictionaryValidationResult } from './shared-dictionary'

/** Owner intent only. The server must verify a fresh, separately reviewed approval. */
export interface DictionaryCreationRecoveryCommandV2 extends DictionaryCreationCommandV2 {
  recovery_id: string
}
export type DictionaryCreationOwnerCommandV2 =
  DictionaryCreationCommandV2 | DictionaryCreationRecoveryCommandV2
export const parseDictionaryCreationOwnerCommandV2 = (
  value: unknown
): DictionaryValidationResult<DictionaryCreationOwnerCommandV2> => {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    !Object.hasOwn(value, 'recovery_id')
  )
    return parseDictionaryCreationCommandV2(value)
  const row = value as Record<string, unknown>
  const { recovery_id, ...normal } = row
  const parsed = parseDictionaryCreationCommandV2(normal)
  if (!parsed.success) return parsed
  if (
    typeof recovery_id !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      recovery_id
    ) ||
    [parsed.data.operation_id, parsed.data.resolution_id].includes(
      recovery_id.toLowerCase()
    )
  )
    return {
      success: false,
      issues: [
        {
          path: 'recovery_id',
          message: 'must be a separate reviewed recovery UUID',
        },
      ],
    }
  return {
    success: true,
    data: { ...parsed.data, recovery_id: recovery_id.toLowerCase() },
  }
}
