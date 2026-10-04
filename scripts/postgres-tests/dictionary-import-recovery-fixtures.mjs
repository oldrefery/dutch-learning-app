import { randomUUID } from 'node:crypto'
import { asUser, literal, owner } from './fixtures.mjs'

export const json = value => `${literal(JSON.stringify(value))}::jsonb`
export const rpc = (name, input) => `SELECT public.${name}(${json(input)});`
export const applyRpc = intent =>
  rpc('apply_dictionary_import_intent_v1', intent)
export const recoverRpc = request =>
  rpc('recover_dictionary_import_v1', request)
export const cancelRpc = request => rpc('cancel_dictionary_import_v1', request)
export const readRpc = intent =>
  rpc('read_dictionary_import_recovery_v1', intent)

export async function importFixture(db, user = owner) {
  const targets = []
  for (const name of ['Original', 'Recovery A', 'Recovery B']) {
    targets.push(
      await db.sql(`INSERT INTO public.collections(user_id,name)
      VALUES ('${user}', '${name}') RETURNING collection_id;`)
    )
  }
  const content = JSON.parse(
    await db.sql(
      `SELECT private.official_dictionary_content_v1(${json({
        entry_id: 'synthetic-recovery',
        dutch_lemma: `fixture-${randomUUID()}`,
        part_of_speech: 'noun',
        article: 'de',
        translations: { en: ['fixture'] },
      })});`
    )
  )
  const intent = {
    protocol_version: 1,
    operation_id: randomUUID(),
    word_id: randomUUID(),
    collection_id: targets[0],
    source: { kind: 'private-copy', content },
  }
  const recovery = (fields = {}) => ({
    protocol_version: 1,
    operation_id: randomUUID(),
    original_intent: intent,
    expected_recovery_version: 0,
    expected_collection_id: targets[0],
    target_collection_id: targets[1],
    ...fields,
  })
  const cancellation = () => ({
    protocol_version: 1,
    operation_id: randomUUID(),
    original_intent: intent,
  })
  const call = (name, input, account = user) =>
    db.sql(asUser(account, rpc(name, input))).then(JSON.parse)
  const row = () =>
    db
      .sql(
        `SELECT to_jsonb(w) FROM public.words w WHERE word_id = '${intent.word_id}';`
      )
      .then(value => (value ? JSON.parse(value) : null))
  const origin = () =>
    db
      .sql(
        `SELECT to_jsonb(o) FROM private.dictionary_import_origins o WHERE word_id = '${intent.word_id}';`
      )
      .then(value => (value ? JSON.parse(value) : null))
  return {
    user,
    targets,
    intent,
    recovery,
    cancellation,
    row,
    origin,
    apply: (input = intent) => call('apply_dictionary_import_intent_v1', input),
    recover: input => call('recover_dictionary_import_v1', input),
    cancel: input => call('cancel_dictionary_import_v1', input),
    read: () => call('read_dictionary_import_recovery_v1', intent),
    call,
  }
}
