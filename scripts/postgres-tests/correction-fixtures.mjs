import { randomUUID } from 'node:crypto'
import { asUser, literal, owner } from './fixtures.mjs'

export const correction = (input, fields = {}) => ({
  word: input.word,
  event: input.event,
  id: randomUUID(),
  revision: 0,
  rating: 'again',
  ...fields,
})

export const correctionSql = input =>
  `SELECT row_to_json(result) FROM public.correct_review_assessment(${[
    input.word,
    input.event,
    input.id,
    input.revision,
    input.rating,
  ]
    .map(literal)
    .join(',')}) result;`

export const correct = async (db, input, user = owner) =>
  JSON.parse(await db.sql(asUser(user, correctionSql(input))))

export const correctionState = async (db, word, user = owner) =>
  JSON.parse(
    await db.sql(
      asUser(
        user,
        `SELECT json_build_object(
    'checkpoints', (SELECT COALESCE(json_agg(c ORDER BY event_id), '[]')
      FROM public.review_progress_checkpoints c WHERE word_id = '${word}'),
    'heads', (SELECT COALESCE(json_agg(h), '[]')
      FROM public.review_progress_heads h WHERE word_id = '${word}'),
    'corrections', (SELECT COALESCE(json_agg(c ORDER BY revision), '[]')
      FROM public.review_assessment_corrections c WHERE word_id = '${word}'),
    'effective', (SELECT COALESCE(json_agg(e ORDER BY event_id), '[]')
      FROM public.effective_review_events e WHERE word_id = '${word}'));`
      )
    )
  )

export const resetSql = word =>
  `SELECT * FROM public.reset_word_learning_progress('${word}', '${randomUUID()}',
    '2026-09-05T14:00:00Z', '2026-09-05');`
