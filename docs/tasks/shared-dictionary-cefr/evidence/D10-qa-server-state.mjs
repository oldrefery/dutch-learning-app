import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { assertQaFixture } from './D08-qa-paths.mjs'

const fixturePath = assertQaFixture(process.argv[2])
const label = process.argv[3]
assert.match(label, /^[a-z0-9-]+$/)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
assert.equal(fixture.project, 'woordenaar-d08-qa.ZFsE50')
assert.equal(fixture.apiUrl, 'http://127.0.0.1:55321')
assert.match(fixture.primary.userId, /^[0-9a-f-]{36}$/)
const sql = `SELECT coalesce(json_agg(t), '[]'::json) FROM (
  SELECT w.word_id,w.dutch_lemma,w.collection_id,w.deleted_at,
    o.original_operation_id,o.recovery_version,o.cancelled,
    (SELECT count(*) FROM private.dictionary_import_receipts r
      WHERE r.user_id = w.user_id AND r.receipt->>'word_id' = w.word_id::text) AS import_receipts,
    (SELECT count(*) FROM private.dictionary_import_recovery_receipts r
      WHERE r.user_id = w.user_id AND r.receipt->>'word_id' = w.word_id::text) AS recovery_receipts
  FROM public.words w JOIN private.dictionary_import_origins o USING(word_id)
  WHERE w.user_id = '${fixture.primary.userId}'
    AND w.dutch_lemma IN ('d10herstel','d10android') ORDER BY w.word_id
) t;`
const result = JSON.parse(
  execFileSync(
    'docker',
    [
      'exec',
      'supabase_db_woordenaar-d08-qa.ZFsE50',
      'psql',
      '-U',
      'postgres',
      '-d',
      'postgres',
      '-XqAt',
      '-v',
      'ON_ERROR_STOP=1',
      '-c',
      sql,
    ],
    { encoding: 'utf8' }
  )
)
writeFileSync(
  join(dirname(fixturePath), `d10-server-${label}.json`),
  JSON.stringify(result, null, 2),
  { flag: 'wx', mode: 0o600 }
)
console.log(JSON.stringify(result))
