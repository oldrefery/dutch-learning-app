import { literal } from './fixtures.mjs'
import {
  configure as configureGeneration,
  json,
  service,
  ready,
  start,
  journal,
  checked,
} from './dictionary-creation-dispatch.fixture.mjs'

export const content = () => ({
  dutch_lemma: 'bank',
  dutch_original: 'bank',
  part_of_speech: 'noun',
  article: 'de',
  translations: { en: ['financial institution'], ru: ['банк'] },
  examples: [
    {
      nl: 'Ik heb geld bij de bank.',
      en: 'I have money at the bank.',
      ru: null,
    },
  ],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: 'banken',
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: 'Financial meaning',
  usage_notes: null,
  image_url: null,
  tts_url: null,
})
export async function configure(db) {
  await configureGeneration(db)
  await db.sql(
    'UPDATE private.dictionary_content_runtime SET creation_judgement_enabled=TRUE,creation_publication_enabled=TRUE;'
  )
}
export async function generated(db, candidate = content(), actor) {
  await configure(db)
  const f = await ready(db, actor)
  const d = (await start(db, f)).dispatch
  await journal(db, f, d, {
    content: candidate,
    confidence: 1,
    reasoning: 'Never a judge input',
  })
  return f
}
export const judge = (db, f, fence = '1') =>
  json(
    db,
    service(
      `SELECT public.start_dictionary_creation_judgement_v1('${f.run}',${literal(fence)});`
    )
  )
export const verdict = (dispatch, change) => {
  const checks = [
    'translations-en',
    'translations-ru',
    'examples',
    'related-words',
    'notes',
    'grammar',
  ].map(dimension => ({
    dimension,
    verdict: 'preserved',
    reason: 'The candidate preserves the protected financial sense.',
    anchor_quote: 'financial institution',
  }))
  if (change) checks[0].verdict = change
  return {
    content: {
      schema_version: 1,
      anchor_sha256: dispatch.input.anchor.anchor_sha256,
      content_sha256: dispatch.input.content_sha256,
      result_sha256: dispatch.input.result_sha256,
      decision:
        change === 'contradicted'
          ? 'different-meaning'
          : change === 'uncertain'
            ? 'uncertain'
            : 'same-meaning',
      checks,
    },
  }
}
export const record = (db, f, d, raw = verdict(d), id = null) =>
  json(
    db,
    service(
      `SELECT public.record_dictionary_creation_judgement_v1('${f.run}','1',${literal(d.input_sha256)},${literal(JSON.stringify(raw))}::JSONB,${literal(id)});`
    )
  ).then(checked)
export const validate = (db, f, fence = '1') =>
  json(
    db,
    service(
      `SELECT public.validate_dictionary_creation_v1('${f.run}',${literal(fence)});`
    )
  )
export const publish = (db, f, validation, fence = '1') =>
  json(
    db,
    service(
      `SELECT public.publish_dictionary_creation_v1('${f.run}',${literal(fence)},'${validation}');`
    )
  ).then(checked)
export async function validated(db, actor) {
  const f = await generated(db, content(), actor)
  const d = (await judge(db, f)).dispatch
  await record(db, f, d)
  return { ...f, d, validation: (await validate(db, f)).validation_id }
}
