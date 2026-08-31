const normalizeSemanticValue = (
  value: string | null | undefined,
  fallback = ''
): string => value?.trim().toLocaleLowerCase('nl-NL') || fallback

export const getSemanticWordKey = (
  dutchLemma: string | null | undefined,
  partOfSpeech: string | null | undefined,
  article: string | null | undefined
): string =>
  [
    normalizeSemanticValue(dutchLemma),
    normalizeSemanticValue(partOfSpeech, 'unknown'),
    normalizeSemanticValue(article),
  ].join('|')
