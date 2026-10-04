// Synthetic fixture, copied only into the isolated native upgrade harness.
export const USER = '10000000-0000-4000-8000-000000000014'
export const WORD = '20000000-0000-4000-8000-000000000014'
export const TARGET = '30000000-0000-4000-8000-000000000014'
export const OPERATION = '40000000-0000-4000-8000-000000000014'
const AT = '2026-10-02T12:00:00Z'
const content = {
  dutch_lemma: 'bewaren',
  dutch_original: null,
  part_of_speech: 'verb',
  article: null,
  translations: { en: ['keep'], ru: [] },
  examples: [],
  is_irregular: false,
  is_reflexive: false,
  is_expression: false,
  expression_type: null,
  is_separable: false,
  prefix_part: null,
  root_verb: null,
  plural: null,
  register: 'neutral',
  synonyms: [],
  antonyms: [],
  conjugation: null,
  preposition: null,
  analysis_notes: 'Synthetic private retained content',
  usage_notes: null,
  image_url: null,
  tts_url: null,
}
export const intent = {
  protocol_version: 1,
  operation_id: OPERATION,
  word_id: WORD,
  collection_id: TARGET,
  source: { kind: 'private-copy', content },
}
export function equal(actual, expected, message) {
  if (JSON.stringify(actual) !== JSON.stringify(expected))
    throw new Error(message)
}
export async function snapshot(db, version) {
  const result = {}
  const tables = {
    collections: 'collection_id',
    words: 'word_id',
    user_progress: 'progress_id',
    review_events: 'event_id',
    review_corrections: 'correction_id',
    learning_commands: 'sequence',
    dictionary_card_content: 'word_id',
    dictionary_content_commands: 'sequence',
    dictionary_import_intents: 'sequence',
    dictionary_personal_refresh_queue: 'word_id',
    ...(version === 15
      ? { dictionary_import_acknowledgements: 'word_id' }
      : {}),
  }
  for (const [table, order] of Object.entries(tables))
    result[table] = await db.getAllAsync(
      `SELECT * FROM ${table} ORDER BY ${order}`
    )
  return result
}
export async function seed(db, version) {
  await db.withExclusiveTransactionAsync(async tx => {
    await tx.runAsync(
      'INSERT INTO collections(collection_id,user_id,name,created_at,updated_at) VALUES (?,?,?,?,?)',
      TARGET,
      USER,
      'Retained migration fixture',
      AT,
      AT
    )
    await tx.runAsync(
      `INSERT INTO words(word_id,user_id,collection_id,dutch_lemma,translations,next_review_date,created_at,updated_at,interval_days,repetition_count,easiness_factor,last_reviewed_at,sync_status)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      WORD,
      USER,
      TARGET,
      content.dutch_lemma,
      JSON.stringify(content.translations),
      '2026-11-01',
      AT,
      AT,
      27,
      7,
      2.35,
      AT,
      'pending'
    )
    await tx.runAsync(
      `INSERT INTO review_events(event_id,user_id,word_id,assessment,review_mode,previous_interval_days,next_interval_days,previous_easiness_factor,next_easiness_factor,reviewed_at)
      VALUES ('review',?,?,'good','recognition',12,27,2.35,2.35,?)`,
      USER,
      WORD,
      AT
    )
    await tx.runAsync(
      `INSERT INTO learning_commands(operation_id,kind,user_id,word_id,reset_at,review_date) VALUES ('reset','reset',?,?,?,'2026-10-02')`,
      USER,
      WORD,
      AT
    )
    await tx.runAsync(
      `INSERT INTO review_corrections(correction_id,event_id,word_id,user_id,expected_revision,assessment,queued_at,status)
      VALUES ('correction','review',?,?,0,'hard',?,'pending')`,
      WORD,
      USER,
      AT
    )
    await tx.runAsync(
      `INSERT INTO user_progress(progress_id,user_id,word_id,status,reviewed_count,created_at,updated_at,sync_status)
      VALUES ('progress',?,?,'learning',7,?,?,'pending')`,
      USER,
      WORD,
      AT,
      AT
    )
    await tx.runAsync(
      `INSERT INTO dictionary_card_content(word_id,user_id,content_version,fallback_content_json,overrides_json,updated_at)
      VALUES (?,?,3,?,'{}',?)`,
      WORD,
      USER,
      JSON.stringify(content),
      AT
    )
    await tx.runAsync(
      `INSERT INTO dictionary_content_commands(operation_id,user_id,word_id,kind,expected_content_version,payload_json,queued_at)
      VALUES ('private-edit',?,?,'edit-private',3,?,?)`,
      USER,
      WORD,
      JSON.stringify({ content }),
      AT
    )
    await tx.runAsync(
      'INSERT INTO dictionary_personal_refresh_queue(word_id,user_id) VALUES (?,?)',
      WORD,
      USER
    )
    if (version === 14)
      await tx.runAsync(
        `INSERT INTO dictionary_import_intents(operation_id,user_id,word_id,payload_json,queued_at)
      VALUES (?,?,?,?,?)`,
        OPERATION,
        USER,
        WORD,
        JSON.stringify(intent),
        AT
      )
    else
      await tx.runAsync(
        'INSERT INTO dictionary_import_acknowledgements(word_id,user_id) VALUES (?,?)',
        WORD,
        USER
      )
  })
}
