import type { Word } from '@/types/database'

export interface RecognitionOption {
  id: string
  label: string
  secondaryLabel?: string | null
  isCorrect: boolean
}

const normalizeAnswer = (answer: string): string =>
  answer.trim().replace(/\s+/g, ' ').toLocaleLowerCase()

const getTranslationKeys = (word: Word): Set<string> =>
  new Set(
    [...word.translations.en, ...(word.translations.ru ?? [])]
      .map(normalizeAnswer)
      .filter(Boolean)
  )

const stableHash = (value: string): number => {
  let hash = 2166136261

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export const getPreferredTranslation = (word: Word): string | null => {
  const translation = [...word.translations.en, ...(word.translations.ru ?? [])]
    .map(value => value.trim())
    .find(Boolean)

  return translation ?? null
}

export const getRussianTranslation = (word: Word): string | null => {
  const translation = word.translations.ru
    ?.map(value => value.trim())
    .find(Boolean)

  return translation ?? null
}

const getRussianSecondaryTranslation = (
  word: Word,
  label: string
): string | null => {
  const translation = getRussianTranslation(word)
  return translation && normalizeAnswer(translation) !== normalizeAnswer(label)
    ? translation
    : null
}

export const getDutchProductionAnswer = (word: Word): string => {
  if (word.part_of_speech === 'noun' && word.article) {
    return `${word.article} ${word.dutch_lemma}`
  }

  return word.dutch_lemma
}

export const buildRecognitionOptions = (
  currentWord: Word,
  vocabulary: Word[],
  maximumOptions = 4
): RecognitionOption[] | null =>
  createRecognitionOptionBuilder(vocabulary)(currentWord, maximumOptions)

/** Normalize vocabulary once per session, not once per question. */
export const createRecognitionOptionBuilder = (vocabulary: Word[]) => {
  const pool = vocabulary
    .map(word => ({
      word,
      label: getPreferredTranslation(word),
      translationKeys: getTranslationKeys(word),
      rank: stableHash(word.word_id),
    }))
    .filter((candidate): candidate is typeof candidate & { label: string } =>
      Boolean(candidate.label)
    )
    .sort(
      (a, b) => a.rank - b.rank || a.word.word_id.localeCompare(b.word.word_id)
    )
  const byPartOfSpeech = new Map<Word['part_of_speech'], typeof pool>()
  for (const candidate of pool) {
    const group = byPartOfSpeech.get(candidate.word.part_of_speech) ?? []
    group.push(candidate)
    byPartOfSpeech.set(candidate.word.part_of_speech, group)
  }
  return (
    currentWord: Word,
    maximumOptions = 4
  ): RecognitionOption[] | null => {
    const correctLabel = getPreferredTranslation(currentWord)
    if (!correctLabel || maximumOptions < 3) return null
    const usedTranslationKeys = getTranslationKeys(currentWord)
    const selected: typeof pool = []
    // One stable pool per session. Rotate per word, prefer its part of speech,
    // and stop as soon as enough semantically distinct alternatives are found.
    const preferred = byPartOfSpeech.get(currentWord.part_of_speech) ?? []
    const seed = stableHash(currentWord.word_id)
    for (const candidates of [preferred, pool].filter(
      group => group.length > 0
    )) {
      const offset = seed % candidates.length
      for (
        let index = 0;
        index < candidates.length && selected.length < maximumOptions - 1;
        index++
      ) {
        const candidate = candidates[(offset + index) % candidates.length]
        if (candidate.word.word_id === currentWord.word_id) continue
        if (
          [...candidate.translationKeys].some(key =>
            usedTranslationKeys.has(key)
          )
        )
          continue
        selected.push(candidate)
        candidate.translationKeys.forEach(key => usedTranslationKeys.add(key))
      }
      if (selected.length >= maximumOptions - 1) break
    }

    if (selected.length < 2) return null

    return [
      {
        id: currentWord.word_id,
        label: correctLabel,
        secondaryLabel: getRussianSecondaryTranslation(
          currentWord,
          correctLabel
        ),
        isCorrect: true,
      },
      ...selected.map(candidate => ({
        id: candidate.word.word_id,
        label: candidate.label,
        secondaryLabel: getRussianSecondaryTranslation(
          candidate.word,
          candidate.label
        ),
        isCorrect: false,
      })),
    ].sort((first, second) => {
      const firstRank = stableHash(`${currentWord.word_id}:option:${first.id}`)
      const secondRank = stableHash(
        `${currentWord.word_id}:option:${second.id}`
      )
      return firstRank - secondRank || first.id.localeCompare(second.id)
    })
  }
}
