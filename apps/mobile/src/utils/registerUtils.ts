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

type DisplayableRegister = 'formal' | 'informal'

const REGISTER_LABELS: Record<DisplayableRegister, string> = {
  formal: 'Formal',
  informal: 'Informal',
}

/**
 * Returns a capitalized display label for a displayable register value.
 * Only accepts narrowed register values ('formal' | 'informal').
 */
export function getRegisterLabel(register: DisplayableRegister): string {
  return REGISTER_LABELS[register]
}
