import {
  prepareNativeReviewQuestions,
  prepareNativeReviewQuestionsAsync,
} from '../questions'
import { makeSession, userId, vocabulary } from './fixtures'

const OLD_SEQUENCE = '9007199254740993'
const OLD_REVISION = 'revision-old'
const NEW_REVISION = 'revision-new'
const DUTCH_PRODUCTION = 'dutch-production'
const MEANING_RECALL = 'meaning-recall'

it('prepares immutable owned questions and options once', () => {
  const session = makeSession()
  const words = JSON.parse(JSON.stringify(vocabulary)) as typeof vocabulary
  session.words = words.slice(0, 1)
  const [question] = prepareNativeReviewQuestions(session, words, userId)
  words[0].translations.en[0] = 'changed'
  expect(question.payload.word.translations.en[0]).toBe('house')
  expect(question.options.find(option => option.isCorrect)?.label).toBe('house')
  expect(prepareNativeReviewQuestions(session, words, 'other')).toEqual([])
})

it.each([2500, 5000])(
  'prepares every word in a %i-word adaptive session while yielding to input',
  async size => {
    const words = Array.from({ length: size }, (_, index) => ({
      ...vocabulary[0],
      word_id: `large-${index}`,
      translations: { en: [`meaning ${index}`] },
    }))
    const session = { ...makeSession('adaptive'), words }
    const progress = jest.fn()
    const yieldToUI = jest.fn().mockResolvedValue(undefined)
    const result = await prepareNativeReviewQuestionsAsync(
      session,
      words,
      userId,
      new AbortController().signal,
      progress,
      yieldToUI
    )
    expect(result).toHaveLength(size)
    expect(result?.map(question => question.wordId)).toEqual(
      words.map(word => word.word_id)
    )
    expect(
      result?.every(
        question =>
          question.options.length === 4 &&
          question.options.filter(option => option.isCorrect).length === 1
      )
    ).toBe(true)
    expect(yieldToUI.mock.calls.length).toBeGreaterThanOrEqual(size / 50)
    expect(
      progress.mock.calls.every(
        ([count], index, calls) => count - (calls[index - 1]?.[0] ?? 0) <= 50
      )
    ).toBe(true)
    expect(words[0].translations.en).toEqual(['meaning 0'])
  },
  15000
)

it('stops preparation after cancellation without returning a partial queue', async () => {
  const abort = new AbortController()
  const progress = jest.fn()
  const result = await prepareNativeReviewQuestionsAsync(
    makeSession(),
    vocabulary,
    userId,
    abort.signal,
    progress,
    async () => {
      abort.abort()
    }
  )
  expect(result).toBeNull()
  expect(progress).not.toHaveBeenCalled()
})

it('keeps asynchronous preparation equivalent to the synchronous contract', async () => {
  const session = makeSession('adaptive')
  expect(
    await prepareNativeReviewQuestionsAsync(
      session,
      vocabulary,
      userId,
      new AbortController().signal,
      () => {},
      async () => {}
    )
  ).toEqual(prepareNativeReviewQuestions(session, vocabulary, userId))
})

it('falls back to recall when there are too few unambiguous choices', () => {
  const [question] = prepareNativeReviewQuestions(
    makeSession(),
    vocabulary.slice(0, 1),
    userId
  )
  expect(question.mode).toBe(MEANING_RECALL)
  expect(question.payload.explanation).toContain('Not enough')
})

it('uses the session adaptive decision and falls back when a production prompt is absent', () => {
  const session = makeSession('adaptive')
  session.adaptiveModeByWordId[vocabulary[0].word_id] = {
    mode: DUTCH_PRODUCTION,
    reason: 'promotion',
    previousMode: MEANING_RECALL,
  }
  expect(
    prepareNativeReviewQuestions(session, vocabulary, userId)[0].mode
  ).toBe(DUTCH_PRODUCTION)
  session.words = [{ ...vocabulary[0], translations: { en: [] } }]
  expect(
    prepareNativeReviewQuestions(session, vocabulary, userId)[0].mode
  ).toBe(MEANING_RECALL)
})

it('freezes all words, shared metadata, distractors and adaptive decisions before preparation yields', async () => {
  const words = Array.from({ length: 105 }, (_, index) => ({
    ...vocabulary[index % 4],
    word_id: `snapshot-${index}`,
    translations: { en: [`old meaning ${index}`] },
    dictionary_content_state: {
      protocol_version: 2 as const,
      mode: 'follow' as const,
      content_version: '9007199254740992',
      reference: { entry_id: 'entry', revision_id: OLD_REVISION },
      adopted_revision_id: OLD_REVISION,
      head_sequence: OLD_SEQUENCE,
      watermark: OLD_SEQUENCE,
    },
    cefr_level: 'A2' as 'A2' | 'B1',
    cefr_status: 'estimated' as const,
    cefr_confidence: 0.8,
  }))
  const session = { ...makeSession('adaptive'), words }
  session.adaptiveModeByWordId[words[104].word_id] = {
    mode: DUTCH_PRODUCTION,
    reason: 'promotion',
    previousMode: MEANING_RECALL,
  }
  const expected = prepareNativeReviewQuestions(session, words, userId)
  let yields = 0
  const result = await prepareNativeReviewQuestionsAsync(
    session,
    words,
    userId,
    new AbortController().signal,
    () => {},
    async () => {
      if (yields++ !== 0) return
      words.forEach(word => {
        word.translations.en[0] = 'new meaning'
        word.dictionary_content_state.reference.revision_id = NEW_REVISION
        word.cefr_level = 'B1'
        word.cefr_confidence = 0.9
      })
      session.config.mode = MEANING_RECALL
      session.adaptiveModeByWordId[words[104].word_id].mode = 'recognition'
    }
  )
  expect(yields).toBeGreaterThan(2)
  expect(result).toEqual(expected)
  expect(result?.[104]).toMatchObject({
    mode: DUTCH_PRODUCTION,
    payload: {
      word: {
        cefr_level: 'A2',
        cefr_confidence: 0.8,
        dictionary_content_state: { reference: { revision_id: OLD_REVISION } },
      },
      translation: 'old meaning 104',
    },
  })
  expect(
    prepareNativeReviewQuestions(session, words, userId)[104]
  ).toMatchObject({
    mode: MEANING_RECALL,
    payload: {
      word: {
        cefr_level: 'B1',
        dictionary_content_state: { reference: { revision_id: NEW_REVISION } },
      },
      translation: 'new meaning',
    },
  })
})
