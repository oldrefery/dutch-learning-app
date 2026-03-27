import type { WordRegister } from '@/types/database'

/**
 * Returns true when the register value should be displayed in the UI.
 * Null, undefined, and 'neutral' are suppressed since neutral is the default.
 * Also narrows the type to 'formal' | 'informal' for downstream usage.
 */
export function isDisplayableRegister(
  register: WordRegister | null | undefined
): register is 'formal' | 'informal' {
  return register != null && register !== 'neutral'
}

const REGISTER_LABELS: Record<string, string> = {
  formal: 'Formal',
  informal: 'Informal',
}

/**
 * Returns a capitalized display label for a register value.
 * Falls back to the raw value if no mapping exists.
 */
export function getRegisterLabel(register: string): string {
  return REGISTER_LABELS[register] ?? register
}
