// Validate newly generated/reused analysis only; never gate existing card reads.
const record = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined

const isInvalidRussian = (value: unknown): boolean => {
  if (typeof value !== 'string' || !value.trim()) return false
  if (!/\p{Script=Cyrillic}/u.test(value)) return true
  // Allow names/acronyms in Russian prose, but reject mixed-script words.
  return (value.match(/[\p{L}\p{M}]+/gu) ?? []).some(
    token =>
      /\p{Script=Cyrillic}/u.test(token) && /\p{Script=Latin}/u.test(token)
  )
}

export function invalidRussianFields(analysis: unknown): string[] {
  const data = record(analysis)
  if (!data) return []
  const invalid: string[] = []
  const check = (value: unknown, path: string) => {
    if (isInvalidRussian(value)) invalid.push(path)
  }
  const translations = record(data.translations)?.ru
  if (Array.isArray(translations)) {
    translations.forEach((value, index) =>
      check(value, `translations.ru[${index}]`)
    )
  }
  if (Array.isArray(data.examples)) {
    data.examples.forEach((example, index) =>
      check(record(example)?.ru, `examples[${index}].ru`)
    )
  }
  const contrasts = record(data.usage_notes)?.contrasts
  if (Array.isArray(contrasts)) {
    contrasts.forEach((contrast, index) =>
      check(
        record(record(contrast)?.example)?.ru,
        `usage_notes.contrasts[${index}].example.ru`
      )
    )
  }
  return invalid
}

export function assertRussianScript(analysis: unknown): void {
  const invalid = invalidRussianFields(analysis)
  if (invalid.length) {
    throw new Error(`Russian analysis must use Cyrillic: ${invalid.join(', ')}`)
  }
}
