import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import {
  classifySavedInventory,
  prepareSavedInventory,
} from './following-inventory.mjs'

const SAFE_MATCH = 'safe-match'
const POSSIBLE_MATCH = 'possible-match'
const PRIVATE_ONLY = 'private-only'
const PROTECTED_OUTPUT = 'output/private-inventory-v2.json'

const row = disposition => ({
  run_id: randomUUID(),
  user_id: randomUUID(),
  word_id: randomUUID(),
  source_sha256: 'a'.repeat(64),
  revision_id: null,
  overrides: {},
  disposition,
})
const cohort = items => [
  { label: 'synthetic', expectedCount: items.length, items },
]

test('covers every historical disposition without promoting text/media matches into reviewed meanings', () => {
  const items = [
    SAFE_MATCH,
    POSSIBLE_MATCH,
    PRIVATE_ONLY,
    'excluded',
    'stale-source',
    'missing-source',
  ].map(row)
  const before = structuredClone(items)
  const result = classifySavedInventory(cohort(items))
  assert.deepEqual(result.cohorts[0].counts, {
    ambiguous: 2,
    'private-review': 1,
    excluded: 1,
    stale: 1,
    missing: 1,
  })
  assert.equal(result.total, 6)
  assert.equal(result.eligible_links, 0)
  assert.ok(result.items.every(item => item.eligible_to_link === false))
  assert.deepEqual(items, before)
  assert.ok(result.items.every(item => !Object.hasOwn(item, 'overrides')))
})

test('rejects incomplete scope, duplicate words across owners/cohorts and malformed evidence', () => {
  const item = row(POSSIBLE_MATCH)
  assert.throws(
    () => classifySavedInventory([{ ...cohort([item])[0], expectedCount: 2 }]),
    /Complete/
  )
  assert.throws(
    () =>
      classifySavedInventory(
        cohort([item, { ...item, user_id: randomUUID() }])
      ),
    /Duplicate/
  )
  for (const delta of [
    { source_sha256: 'bad' },
    { disposition: 'exact-link' },
    { word_id: 'bad' },
    { overrides: null },
  ]) {
    assert.throws(
      () => classifySavedInventory(cohort([{ ...item, ...delta }])),
      /Invalid/
    )
  }
})

test('hash-bound local preparation retains protected IDs separately from sanitized counts and rejects changed input', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'following-inventory-'))
  try {
    const items = [row(SAFE_MATCH), row(PRIVATE_ONLY)]
    const bytes = JSON.stringify(items)
    const input = join(directory, 'input.json')
    const config = join(directory, 'config.json')
    await writeFile(input, bytes)
    await writeFile(
      config,
      JSON.stringify({
        cohorts: [
          {
            label: 'synthetic',
            expectedCount: 2,
            path: input,
            sha256: createHash('sha256').update(bytes).digest('hex'),
          },
        ],
      })
    )
    const result = await prepareSavedInventory(
      config,
      join(directory, 'output')
    )
    assert.deepEqual(
      await prepareSavedInventory(config, join(directory, 'output')),
      result
    )
    const summary = JSON.stringify(result)
    assert.equal(result.live_inventory_fresh, false)
    assert.ok(
      items.every(
        item =>
          !summary.includes(item.word_id) && !summary.includes(item.user_id)
      )
    )
    assert.equal(
      (await stat(join(directory, PROTECTED_OUTPUT))).mode & 0o777,
      0o600
    )
    const protectedBytes = await readFile(join(directory, PROTECTED_OUTPUT))
    assert.equal(
      createHash('sha256').update(protectedBytes).digest('hex'),
      result.protected_inventory_sha256
    )
    await writeFile(input, bytes + ' ')
    await assert.rejects(
      prepareSavedInventory(config, join(directory, 'output')),
      /changed/
    )
    assert.deepEqual(
      await readFile(join(directory, PROTECTED_OUTPUT)),
      protectedBytes
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test('a changed, valid inventory cannot overwrite a committed output intent', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'following-inventory-intent-'))
  try {
    const input = join(directory, 'input.json')
    const config = join(directory, 'config.json')
    const output = join(directory, 'output')
    const prepare = async items => {
      const bytes = JSON.stringify(items)
      await writeFile(input, bytes)
      await writeFile(
        config,
        JSON.stringify({
          cohorts: [
            {
              label: 'synthetic',
              expectedCount: items.length,
              path: input,
              sha256: createHash('sha256').update(bytes).digest('hex'),
            },
          ],
        })
      )
      return prepareSavedInventory(config, output)
    }
    await prepare([row(POSSIBLE_MATCH)])
    const before = await readFile(join(output, 'private-inventory-v2.json'))
    await assert.rejects(prepare([row(PRIVATE_ONLY)]), /output intent changed/)
    assert.deepEqual(
      await readFile(join(output, 'private-inventory-v2.json')),
      before
    )
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
