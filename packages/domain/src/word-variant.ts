const PARTS_OF_SPEECH = {
  adj: 'adjective',
  adjective: 'adjective',
  adv: 'adverb',
  adverb: 'adverb',
  n: 'noun',
  noun: 'noun',
  v: 'verb',
  verb: 'verb',
} as const

type RequestedPartOfSpeech =
  (typeof PARTS_OF_SPEECH)[keyof typeof PARTS_OF_SPEECH]
type DefiniteArticle = 'de' | 'het'

export type WordVariant = {
  lemma: string
  partOfSpeech: string
  article?: DefiniteArticle
}

export type WordVariantChoice = WordVariant & {
  translations: { en: string; ru: string }
}

const normalize = (value: string) =>
  value.normalize('NFC').trim().replace(/\s+/g, ' ')

const readArticle = (value: unknown): DefiniteArticle | undefined =>
  value === 'de' || value === 'het' ? value : undefined

export function parseWordVariantInput(input: string) {
  const value = normalize(input)
  const suffix =
    /\s*\(\s*(adj(?:ective)?|adv(?:erb)?|n(?:oun)?|v(?:erb)?|de|het)\s*\)$/i.exec(
      value
    ) ?? /\s+(adj(?:ective)?|adv(?:erb)?|n(?:oun)?|v(?:erb)?)$/i.exec(value)
  const base = suffix ? value.slice(0, suffix.index).trim() : value
  const hint = suffix?.[1].toLowerCase()
  const trailingArticle = readArticle(hint)
  const leading = /^(de|het) (\S+)$/i.exec(base)
  const leadingArticle = readArticle(leading?.[1].toLowerCase())
  const article = trailingArticle ?? leadingArticle
  const explicitPartOfSpeech = hint
    ? PARTS_OF_SPEECH[hint as keyof typeof PARTS_OF_SPEECH]
    : undefined
  const partOfSpeech: RequestedPartOfSpeech | undefined =
    explicitPartOfSpeech ?? (article ? 'noun' : undefined)
  const error =
    suffix && !base
      ? 'Enter a Dutch word before the hint.'
      : (leadingArticle &&
            trailingArticle &&
            leadingArticle !== trailingArticle) ||
          (article && partOfSpeech !== 'noun')
        ? 'The article and word hint disagree. Check your input.'
        : null

  return {
    word: leading?.[2] ?? base,
    article,
    partOfSpeech,
    error,
  }
}

export const WORD_VARIANT_INPUT_TIP = 'Try “overleden adj” or “idee (het)”.'

export function wordVariantInputLabel(input: string) {
  const { article, partOfSpeech, error } = parseWordVariantInput(input)
  if (error || !partOfSpeech) return WORD_VARIANT_INPUT_TIP
  const label = partOfSpeech[0].toUpperCase() + partOfSpeech.slice(1)
  return article ? `${label} · ${article}` : label
}

export function matchesWordVariant(
  variant: WordVariant,
  requested: Partial<WordVariant>
) {
  return (
    (!requested.lemma ||
      normalize(variant.lemma).toLowerCase() ===
        normalize(requested.lemma).toLowerCase()) &&
    (!requested.partOfSpeech ||
      variant.partOfSpeech === requested.partOfSpeech) &&
    (!requested.article || variant.article === requested.article)
  )
}

export function readWordVariant(value: unknown): WordVariant | null {
  if (!value || typeof value !== 'object') return null
  const { lemma, partOfSpeech, article } = value as Record<string, unknown>
  if (
    typeof lemma !== 'string' ||
    !lemma.trim() ||
    lemma.length > 120 ||
    typeof partOfSpeech !== 'string' ||
    !/^[a-z][a-z -]{0,39}$/.test(partOfSpeech) ||
    (article != null &&
      article !== '' &&
      (!readArticle(article) || partOfSpeech !== 'noun'))
  )
    return null
  const definiteArticle = readArticle(article)
  return {
    lemma: normalize(lemma).toLowerCase(),
    partOfSpeech,
    ...(definiteArticle ? { article: definiteArticle } : {}),
  }
}

export function readWordVariantChoices(value: unknown): WordVariantChoice[] {
  if (!Array.isArray(value)) return []
  const choices = new Map<string, WordVariantChoice>()
  for (const entry of value.slice(0, 12)) {
    const variant = readWordVariant(entry)
    const translations = entry?.translations
    if (
      !variant ||
      typeof translations?.en !== 'string' ||
      typeof translations?.ru !== 'string' ||
      !translations.en.trim() ||
      !translations.ru.trim() ||
      translations.en.length > 120 ||
      translations.ru.length > 120
    )
      continue
    choices.set(JSON.stringify(variant), {
      ...variant,
      translations: { en: translations.en.trim(), ru: translations.ru.trim() },
    })
  }
  return [...choices.values()].slice(0, 6)
}

export function wordVariantChoiceLabel(
  choice: WordVariantChoice,
  language: 'en' | 'ru'
) {
  const article = choice.article ? `${choice.article} ` : ''
  return `${article}${choice.lemma} · ${choice.partOfSpeech} · ${choice.translations[language]}`
}
