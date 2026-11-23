import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { before, after, test } from 'node:test'
import { createCluster } from './cluster.mjs'
import { asUser, owner, seedUsers, seedWord, state } from './fixtures.mjs'

let db
before(async () => {
  db = await createCluster()
  await seedUsers(db)
})
after(async () => {
  await db?.close()
})

test('fresh migrations include writable nullable word analysis notes', async () => {
  const word = await seedWord(db)
  assert.equal((await state(db, word)).word.analysis_notes, null)
  await db.sql(
    asUser(
      owner,
      `UPDATE public.words SET analysis_notes='User note'
    WHERE word_id='${word}';`
    )
  )
  assert.equal((await state(db, word)).word.analysis_notes, 'User note')
})

test('repair migration preserves an existing deployed column and its contents', async () => {
  const word = await seedWord(db)
  await db.sql(
    `UPDATE public.words SET analysis_notes='Keep existing notes' WHERE word_id='${word}';`
  )
  await db.sql(
    await readFile(
      new URL(
        '../../supabase/migrations/20260905210000_restore_words_analysis_notes.sql',
        import.meta.url
      ),
      'utf8'
    )
  )
  assert.equal(
    (await state(db, word)).word.analysis_notes,
    'Keep existing notes'
  )
})

test('word variant choices are writable by the service role and private to clients', async () => {
  await db.sql(`
    SET ROLE service_role;
    INSERT INTO public.word_variant_choices_cache (lookup_form, choices)
    VALUES ('idee', '[{"lemma":"idee","article":"het"},{"lemma":"idee","article":"de"}]');
    UPDATE public.word_variant_choices_cache SET updated_at = now() WHERE lookup_form = 'idee';
    RESET ROLE;
  `)
  assert.equal(
    await db.sql(
      `SELECT jsonb_array_length(choices) FROM public.word_variant_choices_cache WHERE lookup_form = 'idee';`
    ),
    '2'
  )
  for (const role of ['anon', 'authenticated']) {
    await assert.rejects(
      db.sql(
        `SET ROLE ${role}; SELECT choices FROM public.word_variant_choices_cache;`
      ),
      /permission denied/
    )
  }
})
