import { prepareNativeReviewQuestions } from '../questions'
import { makeSession, userId, vocabulary } from './fixtures'

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
    mode: 'dutch-production',
    reason: 'promotion',
    previousMode: MEANING_RECALL,
  }
  expect(
    prepareNativeReviewQuestions(session, vocabulary, userId)[0].mode
  ).toBe('dutch-production')
  session.words = [{ ...vocabulary[0], translations: { en: [] } }]
  expect(
    prepareNativeReviewQuestions(session, vocabulary, userId)[0].mode
  ).toBe(MEANING_RECALL)
})
