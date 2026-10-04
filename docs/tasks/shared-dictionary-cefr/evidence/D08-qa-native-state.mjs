import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { readFileSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { assertQaFixture } from './D08-qa-paths.mjs'

const fixturePath = realpathSync(process.argv[2])
assertQaFixture(fixturePath)
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
const label = process.argv[3]
assert.match(label, /^[a-z0-9-]+$/)
const platform = process.argv[4] ?? 'ios'
assert.ok(platform === 'ios' || platform === 'android')
const getIosDatabase = () => {
  const device = 'DDEDCE4E-153B-48A4-A47C-B4ED0F499F1F'
  const container = execFileSync(
    'xcrun',
    [
      'simctl',
      'get_app_container',
      device,
      'com.oldrefery.dutch-learning-app',
      'data',
    ],
    { encoding: 'utf8' }
  ).trim()
  assert.ok(
    container.includes(`/Devices/${device}/data/Containers/Data/Application/`)
  )
  return join(container, 'Documents/SQLite/dutch_learning.db')
}
const db =
  platform === 'ios'
    ? getIosDatabase()
    : '/data/user/0/com.oldrefery.dutchlearningapp/files/SQLite/dutch_learning.db'
const query = sql =>
  JSON.parse(
    execFileSync(
      platform === 'ios'
        ? 'sqlite3'
        : '/Users/devrush/Library/Android/sdk/platform-tools/adb',
      platform === 'ios'
        ? ['-readonly', '-json', db, sql]
        : [
            '-s',
            'emulator-5584',
            'shell',
            'su',
            '0',
            'sqlite3',
            '-readonly',
            '-json',
            db,
            `'${sql.replaceAll("'", "'\\''")}'`,
          ],
      {
        encoding: 'utf8',
      }
    ).trim() || '[]'
  )
const owners = query('SELECT DISTINCT user_id FROM words')
assert.ok(
  owners.every(row =>
    [fixture.primary.userId, fixture.isolated.userId].includes(row.user_id)
  )
)
const tables = new Set(
  query("SELECT name FROM sqlite_master WHERE type = 'table'").map(
    row => row.name
  )
)
const optionalTable = name =>
  tables.has(name) ? query(`SELECT * FROM ${name}`) : []
const snapshot = {
  collections: query(
    'SELECT collection_id,user_id,name,sync_status FROM collections ORDER BY collection_id'
  ),
  placement: query(
    'SELECT word_id,collection_id,sync_status,deleted_at FROM words ORDER BY word_id'
  ),
  imports: {
    intents: optionalTable('dictionary_import_intents'),
    acknowledgements: optionalTable('dictionary_import_acknowledgements'),
    delivery: optionalTable('dictionary_import_delivery'),
    recovery: optionalTable('dictionary_import_recovery_outbox'),
    personalRefresh: optionalTable('dictionary_personal_refresh_queue'),
  },
  words: query(
    'SELECT word_id,user_id,dutch_lemma,translations,image_url,interval_days,repetition_count,easiness_factor,next_review_date,last_reviewed_at,deleted_at FROM words ORDER BY word_id'
  ),
  commands: query(
    'SELECT * FROM dictionary_content_commands ORDER BY sequence'
  ),
  states: query('SELECT * FROM dictionary_card_content ORDER BY word_id'),
  cursors: query('SELECT * FROM dictionary_change_cursors'),
  hydration: query('SELECT * FROM dictionary_card_refresh_queue'),
  revisions: query(
    'SELECT revision_id,entry_id FROM dictionary_revision_cache'
  ),
  cefrHeads: query(
    'SELECT entry_id,input_sha256,assessment_id FROM dictionary_cefr_head_cache ORDER BY entry_id,input_sha256'
  ),
  learning: {
    events: query('SELECT * FROM review_events ORDER BY event_id'),
    commands: query('SELECT * FROM learning_commands ORDER BY sequence'),
    corrections: query(
      'SELECT * FROM review_corrections ORDER BY correction_id'
    ),
    progress: query('SELECT * FROM user_progress ORDER BY progress_id'),
  },
}
const output = join(dirname(fixturePath), `${platform}-state-${label}.json`)
writeFileSync(output, JSON.stringify(snapshot, null, 2) + '\n', {
  flag: 'wx',
  mode: 0o600,
})
console.log(
  JSON.stringify({
    output,
    words: snapshot.words.map(word => ({
      lemma: word.dutch_lemma,
      translations: word.translations,
    })),
    commands: snapshot.commands.map(row => ({
      operationId: row.operation_id,
      expectedVersion: row.expected_content_version,
      status: row.status,
    })),
    hydration: snapshot.hydration.length,
    revisions: snapshot.revisions.length,
  })
)
