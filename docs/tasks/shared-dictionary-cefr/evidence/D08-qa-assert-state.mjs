import assert from 'node:assert/strict'
import { readFileSync, realpathSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { assertQaRoot } from './D08-qa-paths.mjs'

const readSnapshot = value => {
  const path = realpathSync(value)
  assertQaRoot(dirname(path), 'native')
  assert.match(basename(path), /^(ios|android)-state-[a-z0-9-]+\.json$/)
  return JSON.parse(readFileSync(path, 'utf8'))
}
const before = readSnapshot(process.argv[2])
const after = readSnapshot(process.argv[3])
const mode = process.argv[4]
const learningFields = [
  'word_id',
  'user_id',
  'interval_days',
  'repetition_count',
  'easiness_factor',
  'next_review_date',
  'last_reviewed_at',
]
const pick = (row, fields) =>
  Object.fromEntries(fields.map(field => [field, row[field]]))
assert.deepEqual(
  after.words.map(row => pick(row, learningFields)),
  before.words.map(row => pick(row, learningFields))
)
assert.deepEqual(after.learning, before.learning)
if (mode === 'restart-pending') {
  assert.ok(before.commands.length > 0)
  const identityFields = [
    'operation_id',
    'user_id',
    'word_id',
    'kind',
    'expected_content_version',
    'payload_json',
  ]
  assert.deepEqual(
    after.commands.map(row => pick(row, identityFields)),
    before.commands.map(row => pick(row, identityFields))
  )
  assert.deepEqual(after.states, before.states)
  assert.ok(
    after.commands.every(row => ['pending', 'error'].includes(row.status))
  )
  // The legacy words row may refresh independently. The private card overlay,
  // command payload and native UI are authoritative while delivery is pending.
} else if (
  mode === 'dependency-recovered' ||
  mode === 'card-dependency-recovered'
) {
  assert.ok(before.hydration.length > 0)
  assert.equal(after.commands.length, 0)
  assert.equal(after.hydration.length, 0)
  const previousCursor = before.cursors[0]
  const recoveredCursor = after.cursors[0]
  assert.equal(recoveredCursor.user_id, previousCursor.user_id)
  if (mode === 'dependency-recovered') {
    assert.ok(
      recoveredCursor.committed_version > previousCursor.committed_version
    )
  } else {
    assert.equal(
      recoveredCursor.committed_version,
      previousCursor.committed_version
    )
  }
} else {
  assert.equal(mode, 'acknowledged')
  assert.ok(before.commands.length > 0)
  assert.equal(after.commands.length, 0)
  assert.equal(after.hydration.length, 0)
}
console.log(JSON.stringify({ mode, learningUnchanged: true, passed: true }))
