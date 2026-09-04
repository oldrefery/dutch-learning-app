import type { Word } from '@/types/database'

export interface RecognitionOption {
  id: string
  label: string
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
): RecognitionOption[] | null => {
  const correctLabel = getPreferredTranslation(currentWord)
  if (!correctLabel || maximumOptions < 3) return null

  const currentTranslationKeys = getTranslationKeys(currentWord)
  const usedTranslationKeys = new Set(currentTranslationKeys)

  const candidates = vocabulary
    .filter(word => word.word_id !== currentWord.word_id)
    .map(word => ({
      word,
      label: getPreferredTranslation(word),
      translationKeys: getTranslationKeys(word),
    }))
    .filter(
      (candidate): candidate is typeof candidate & { label: string } =>
        Boolean(candidate.label) &&
        ![...candidate.translationKeys].some(key =>
          currentTranslationKeys.has(key)
        )
    )
    .sort((first, second) => {
      const firstMatchesPartOfSpeech =
        first.word.part_of_speech === currentWord.part_of_speech
      const secondMatchesPartOfSpeech =
        second.word.part_of_speech === currentWord.part_of_speech

      if (firstMatchesPartOfSpeech !== secondMatchesPartOfSpeech) {
        return firstMatchesPartOfSpeech ? -1 : 1
      }

      const firstRank = stableHash(
        `${currentWord.word_id}:${first.word.word_id}`
      )
      const secondRank = stableHash(
        `${currentWord.word_id}:${second.word.word_id}`
      )

      return (
        firstRank - secondRank ||
        first.word.word_id.localeCompare(second.word.word_id)
      )
    })
    .filter(candidate => {
      const hasSemanticDuplicate = [...candidate.translationKeys].some(key =>
        usedTranslationKeys.has(key)
      )
      if (hasSemanticDuplicate) return false
      candidate.translationKeys.forEach(key => usedTranslationKeys.add(key))
      return true
    })
    .slice(0, maximumOptions - 1)

  if (candidates.length < 2) return null

  return [
    {
      id: currentWord.word_id,
      label: correctLabel,
      isCorrect: true,
    },
    ...candidates.map(candidate => ({
      id: candidate.word.word_id,
      label: candidate.label,
      isCorrect: false,
    })),
  ].sort((first, second) => {
    const firstRank = stableHash(`${currentWord.word_id}:option:${first.id}`)
    const secondRank = stableHash(`${currentWord.word_id}:option:${second.id}`)
    return firstRank - secondRank || first.id.localeCompare(second.id)
  })
}
