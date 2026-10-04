import assert from 'node:assert/strict'
import { realpathSync } from 'node:fs'
import { basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const reportsRoot = fileURLToPath(
  new URL('../../../../reports/shared-dictionary-cefr', import.meta.url)
)

export function assertQaRoot(value, kind) {
  const root = realpathSync(value)
  assert.ok(kind === 'qa' || kind === 'native')
  assert.match(
    basename(root),
    new RegExp(`^woordenaar-d08-${kind}\\.[A-Za-z0-9]+$`)
  )
  assert.ok(
    ['/private/tmp', reportsRoot].includes(dirname(root)),
    'Unexpected QA root'
  )
  return root
}

export function assertQaFixture(value) {
  const path = realpathSync(value)
  assert.equal(basename(path), 'fixture-private.json')
  assertQaRoot(dirname(path), 'native')
  return path
}
