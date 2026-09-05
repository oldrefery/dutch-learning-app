import { randomUUID } from 'node:crypto'

export const owner = '11111111-1111-4111-8111-111111111111'
export const other = '22222222-2222-4222-8222-222222222222'
export const reviewedAt = '2026-09-05T12:00:00+00:00'

// Only synthetic fixture values enter SQL. No application environment is loaded.
export const literal = value =>
  value === null ? 'NULL' : `'${String(value).replaceAll("'", "''")}'`
export const asUser = (user, sql) => `SET ROLE authenticated;
  SET request.jwt.claim.sub = ${literal(user ?? '')}; ${sql}`

export async function seedUsers(db) {
  await db.sql(`INSERT INTO auth.users(id, email) VALUES
    ('${owner}', 'review-owner@example.invalid'),
    ('${other}', 'review-other@example.invalid');`)
}

export async function seedWord(db, user = owner, progress = {}) {
  const id = randomUUID()
  await db.sql(`INSERT INTO public.words(word_id, user_id, dutch_lemma,
    translations, tts_url, interval_days, repetition_count, easiness_factor)
    VALUES ('${id}', '${user}', '${id}', '{}', '',
      ${progress.intervalDays ?? 1}, ${progress.repetitionCount ?? 0},
      ${progress.easinessFactor ?? 2.5});`)
  return id
}

export function assessment(word, fields = {}) {
  return {
    word,
    event: randomUUID(),
    rating: 'good',
    mode: 'meaning-recall',
    correct: true,
    responseTime: 750,
    at: reviewedAt,
    date: '2026-09-05',
    ...fields,
  }
}

export function rpc(input) {
  return `SELECT row_to_json(result) FROM public.record_review_assessment(
    ${[
      input.word,
      input.event,
      input.rating,
      input.mode,
      input.correct,
      input.responseTime,
      input.at,
      input.date,
    ]
      .map(literal)
      .join(',')}
  ) result;`
}

export async function review(db, input, user = owner) {
  return JSON.parse(await db.sql(asUser(user, rpc(input))))
}

export async function state(db, word) {
  return JSON.parse(
    await db.sql(`SELECT json_build_object(
    'word', (SELECT row_to_json(w) FROM public.words w WHERE word_id = '${word}'),
    'events', (SELECT COALESCE(json_agg(e ORDER BY event_id), '[]')
      FROM public.review_events e WHERE word_id = '${word}'));`)
  )
}
