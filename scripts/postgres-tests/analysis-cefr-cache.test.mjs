import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { after, before, test } from 'node:test'
import { createCluster } from './cluster.mjs'

const migration = '20261002130000_add_analysis_cefr_estimate.sql'
const estimate = {
  level: 'A1',
  status: 'estimated',
  source: 'model',
  confidence: 0.8,
  method: 'gemini',
  method_version: 'fixture-v1',
  input_version: 'word-analysis-cefr-v1',
  input_sha256: 'a'.repeat(64),
}
const value = x => `'${JSON.stringify(x).replaceAll("'", "''")}'::jsonb`
let db
let oldRow
before(async () => {
  db = await createCluster({
    throughMigration: '20261002120000_add_dictionary_import_recovery.sql',
  })
  await db.sql(
    `INSERT INTO public.word_analysis_cache(dutch_lemma,dutch_original,part_of_speech,translations,cache_version) VALUES('huis','het huis','noun','{"en":["house"],"ru":[]}',2)`
  )
  oldRow = JSON.parse(
    await db.sql('SELECT row_to_json(c) FROM public.word_analysis_cache c')
  )
  await db.sql(
    await readFile(
      new URL(`../../supabase/migrations/${migration}`, import.meta.url),
      'utf8'
    )
  )
})
after(async () => {
  if (db) await db.close()
})

test('additive migration preserves the old cache row and usage/version/TTL', async () => {
  const row = JSON.parse(
    await db.sql('SELECT row_to_json(c) FROM public.word_analysis_cache c')
  )
  assert.equal(row.cefr_estimate, null)
  delete row.cefr_estimate
  assert.deepEqual(row, oldRow)
})

test('validated estimate and explicit unknown round-trip without dictionary publication', async () => {
  await db.sql(
    `UPDATE public.word_analysis_cache SET cefr_estimate=${value(estimate)}`
  )
  assert.deepEqual(
    JSON.parse(
      await db.sql('SELECT cefr_estimate FROM public.word_analysis_cache')
    ),
    estimate
  )
  await db.sql(
    `UPDATE public.word_analysis_cache SET cefr_estimate=${value({ ...estimate, level: null, status: 'unknown', confidence: null })}`
  )
  assert.equal(
    await db.sql('SELECT count(*) FROM public.dictionary_cefr_assessments'),
    '0'
  )
  assert.equal(
    await db.sql('SELECT count(*) FROM public.dictionary_cefr_heads'),
    '0'
  )
})

test('database rejects malformed level/confidence/provenance/version metadata', async () => {
  for (const patch of [
    { level: 'C3' },
    { confidence: '0.8' },
    { confidence: 2 },
    { status: 'reviewed' },
    { source: 'editorial' },
    { input_version: 'dictionary-v1' },
    { input_sha256: 'bad' },
    { method: ' ' },
    { method_version: '' },
  ]) {
    await assert.rejects(
      db.sql(
        `UPDATE public.word_analysis_cache SET cefr_estimate=${value({ ...estimate, ...patch })}`
      ),
      /word_analysis_cache_cefr_estimate_valid/
    )
  }
  for (const invalid of [{}, [], { ...estimate, confidence: undefined }]) {
    await assert.rejects(
      db.sql(
        `UPDATE public.word_analysis_cache SET cefr_estimate=${value(invalid)}`
      ),
      /word_analysis_cache_cefr_estimate_valid/
    )
  }
})

test('ordinary clients cannot write estimates and legacy refresh remains compatible', async () => {
  await assert.rejects(
    db.sql(
      `SET ROLE authenticated; UPDATE public.word_analysis_cache SET cefr_estimate=${value(estimate)}`
    ),
    /permission denied/
  )
  await db.sql(
    "UPDATE public.word_analysis_cache SET analysis_notes='legacy refreshed'"
  )
  assert.equal(
    await db.sql(
      "SELECT cefr_estimate->>'status' FROM public.word_analysis_cache"
    ),
    'unknown'
  )
})
