import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { basename, dirname, join } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { assertQaFixture, assertQaRoot } from './D08-qa-paths.mjs'

const stack = assertQaRoot(process.argv[2], 'qa')
const fixturePath = assertQaFixture(process.argv[3])
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
assert.equal(fixture.project, basename(stack))
assert.equal(fixture.apiUrl, 'http://127.0.0.1:55321')
assert.match(fixture.primary.email, /^d08-primary-[0-9a-f-]+@example\.invalid$/)
const root = dirname(fixturePath)
const snapshot = JSON.parse(
  readFileSync(join(root, 'ios-state-d10-move-queued.json'), 'utf8')
)
assert.equal(snapshot.imports.recovery.length, 1)
const earlier = JSON.parse(snapshot.imports.recovery[0].payload_json)
assert.equal(earlier.original_intent.source.content.dutch_lemma, 'd10herstel')
const status = JSON.parse(
  execFileSync('supabase', ['status', '--workdir', stack, '-o', 'json'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
)
assert.equal(status.API_URL, fixture.apiUrl)
const client = createClient(fixture.apiUrl, status.ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const ok = result => {
  assert.equal(result.error, null, result.error?.message)
  return result.data
}
ok(
  await client.auth.signInWithPassword({
    email: fixture.primary.email,
    password: fixture.primary.password,
  })
)
const state = ok(
  await client.rpc('read_dictionary_import_recovery_v1', {
    p_intent: earlier.original_intent,
  })
)
assert.equal(state.state, 'active')
assert.equal(state.recovery_version, 1)
assert.equal(state.collection_id, earlier.target_collection_id)
const request = {
  protocol_version: 1,
  operation_id: randomUUID(),
  original_intent: earlier.original_intent,
  expected_recovery_version: state.recovery_version,
  expected_collection_id: state.collection_id,
  target_collection_id: earlier.original_intent.collection_id,
}
// Persist before the RPC; do not repeat an uncertain mutation with a new UUID.
writeFileSync(
  join(root, 'd10-peer-recovery-request.json'),
  JSON.stringify(request, null, 2),
  { flag: 'wx', mode: 0o600 }
)
const receipt = ok(
  await client.rpc('recover_dictionary_import_v1', { p_request: request })
)
writeFileSync(
  join(root, 'd10-peer-recovery-receipt.json'),
  JSON.stringify(receipt, null, 2),
  { flag: 'wx', mode: 0o600 }
)
console.log(JSON.stringify({ receipt }))
