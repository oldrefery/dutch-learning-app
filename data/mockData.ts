import type { Word, Collection, WordTranslations, WordExample } from '@/types/database'

// Mock collections
export const mockCollections: Collection[] = [
  {
    collection_id: '1',
    user_id: 'dev-user',
    name: 'Basic Verbs',
    created_at: '2025-09-01T10:00:00Z',
  },
  {
    collection_id: '2',
    user_id: 'dev-user',
    name: 'Food & Cooking',
    created_at: '2025-09-02T14:30:00Z',
  },
  {
    collection_id: '3',
    user_id: 'dev-user',
    name: 'Daily Conversations',
    created_at: '2025-09-03T09:15:00Z',
  },
]

// Mock words
export const mockWords: Word[] = [
  {
    word_id: '1',
    user_id: 'dev-user',
    collection_id: '1',
    dutch_lemma: 'kopen',
    dutch_original: 'gekocht',
    part_of_speech: 'verb',
    is_irregular: true,
    translations: {
      en: ['to buy', 'to purchase'],
      ru: ['покупать', 'приобретать'],
    } as WordTranslations,
    examples: [
      {
        nl: 'Ik heb gisteren een nieuwe auto gekocht.',
        en: 'I bought a new car yesterday.',
        ru: 'Я купил новую машину вчера.',
      },
      {
        nl: 'Waar kun je verse groenten kopen?',
        en: 'Where can you buy fresh vegetables?',
        ru: 'Где можно купить свежие овощи?',
      },
    ] as WordExample[],
    image_url: null,
    tts_url: 'https://example.com/tts/kopen.mp3',
    interval_days: 2,
    repetition_count: 1,
    easiness_factor: 2.5,
    next_review_date: '2025-09-04',
    last_reviewed_at: '2025-09-02T16:20:00Z',
    created_at: '2025-09-01T10:30:00Z',
  },
  {
    word_id: '2',
    user_id: 'dev-user',
    collection_id: '1',
    dutch_lemma: 'lopen',
    dutch_original: 'loop',
    part_of_speech: 'verb',
    is_irregular: false,
    translations: {
      en: ['to walk', 'to run'],
      ru: ['ходить', 'бегать'],
    } as WordTranslations,
    examples: [
      {
        nl: 'Ik loop elke dag naar het werk.',
        en: 'I walk to work every day.',
        ru: 'Я хожу на работу каждый день.',
      },
    ] as WordExample[],
    image_url: null,
    tts_url: 'https://example.com/tts/lopen.mp3',
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: '2025-09-03',
    last_reviewed_at: null,
    created_at: '2025-09-02T11:00:00Z',
  },
  {
    word_id: '3',
    user_id: 'dev-user',
    collection_id: '2',
    dutch_lemma: 'eten',
    dutch_original: 'eet',
    part_of_speech: 'verb',
    is_irregular: true,
    translations: {
      en: ['to eat'],
      ru: ['есть', 'кушать'],
    } as WordTranslations,
    examples: [
      {
        nl: 'Wat eet jij graag?',
        en: 'What do you like to eat?',
        ru: 'Что ты любишь есть?',
      },
      {
        nl: 'We eten vanavond thuis.',
        en: 'We are eating at home tonight.',
        ru: 'Мы ужинаем дома сегодня вечером.',
      },
    ] as WordExample[],
    image_url: null,
    tts_url: 'https://example.com/tts/eten.mp3',
    interval_days: 4,
    repetition_count: 2,
    easiness_factor: 2.7,
    next_review_date: '2025-09-05',
    last_reviewed_at: '2025-09-01T19:45:00Z',
    created_at: '2025-09-01T15:20:00Z',
  },
  {
    word_id: '4',
    user_id: 'dev-user',
    collection_id: '2',
    dutch_lemma: 'brood',
    dutch_original: null,
    part_of_speech: 'noun',
    is_irregular: false,
    translations: {
      en: ['bread'],
      ru: ['хлеб'],
    } as WordTranslations,
    examples: [
      {
        nl: 'Ik koop vers brood bij de bakker.',
        en: 'I buy fresh bread at the bakery.',
        ru: 'Я покупаю свежий хлеб в булочной.',
      },
    ] as WordExample[],
    image_url: null,
    tts_url: 'https://example.com/tts/brood.mp3',
    interval_days: 1,
    repetition_count: 0,
    easiness_factor: 2.5,
    next_review_date: '2025-09-03',
    last_reviewed_at: null,
    created_at: '2025-09-03T08:10:00Z',
  },
  {
    word_id: '5',
    user_id: 'dev-user',
    collection_id: '3',
    dutch_lemma: 'hallo',
    dutch_original: null,
    part_of_speech: 'interjection',
    is_irregular: false,
    translations: {
      en: ['hello', 'hi'],
      ru: ['привет', 'здравствуйте'],
    } as WordTranslations,
    examples: [
      {
        nl: 'Hallo, hoe gaat het met je?',
        en: 'Hello, how are you doing?',
        ru: 'Привет, как дела?',
      },
    ] as WordExample[],
    image_url: null,
    tts_url: 'https://example.com/tts/hallo.mp3',
    interval_days: 7,
    repetition_count: 3,
    easiness_factor: 3.0,
    next_review_date: '2025-09-10',
    last_reviewed_at: '2025-09-03T12:00:00Z',
    created_at: '2025-08-30T10:00:00Z',
  },
]

// Helper functions to work with mock data
export const getMockWordsByCollection = (collectionId: string): Word[] => {
  return mockWords.filter(word => word.collection_id === collectionId)
}

export const getMockWordsForReview = (): Word[] => {
  const today = new Date().toISOString().split('T')[0]
  return mockWords.filter(word => word.next_review_date <= today)
}

export const getMockCollectionStats = (collectionId: string) => {
  const collectionWords = getMockWordsByCollection(collectionId)
  const totalWords = collectionWords.length
  const dueForReview = collectionWords.filter(word => {
    const today = new Date().toISOString().split('T')[0]
    return word.next_review_date <= today
  }).length

  return {
    totalWords,
    dueForReview,
    masteredWords: collectionWords.filter(word => word.repetition_count >= 3).length,
  }
}

export const getMockOverallStats = () => {
  const totalWords = mockWords.length
  const totalCollections = mockCollections.length
  const wordsForReview = getMockWordsForReview().length
  const masteredWords = mockWords.filter(word => word.repetition_count >= 3).length

  return {
    totalWords,
    totalCollections,
    wordsForReview,
    masteredWords,
    currentStreak: 5, // Mock streak
    dailyGoal: 20, // Mock daily goal
    dailyProgress: 12, // Mock progress
  }
}
