import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const hash = /^[0-9a-f]{64}$/
const dispositions = {
  'safe-match': 'ambiguous',
  'possible-match': 'ambiguous',
  'private-only': 'private-review',
  excluded: 'excluded',
  'stale-source': 'stale',
  'missing-source': 'missing',
}
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex')
const record = value =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** Historical D06 candidates are holds until a separate full-content meaning review. */
export function classifySavedInventory(cohorts) {
  assert.ok(
    Array.isArray(cohorts) && cohorts.length > 0,
    'Inventory scope required'
  )
  const seen = new Set()
  const labels = new Set()
  const items = []
  const summaries = []
  for (const cohort of cohorts) {
    assert.ok(
      record(cohort) &&
        typeof cohort.label === 'string' &&
        cohort.label.length > 0 &&
        !labels.has(cohort.label) &&
        Number.isSafeInteger(cohort.expectedCount) &&
        cohort.expectedCount >= 0 &&
        Array.isArray(cohort.items) &&
        cohort.items.length === cohort.expectedCount,
      'Complete unique cohort scope required'
    )
    labels.add(cohort.label)
    const counts = {}
    for (const item of cohort.items) {
      assert.ok(
        record(item) &&
          uuid.test(item.word_id) &&
          uuid.test(item.user_id) &&
          uuid.test(item.run_id) &&
          hash.test(item.source_sha256) &&
          record(item.overrides) &&
          (item.revision_id === null || uuid.test(item.revision_id)) &&
          Object.hasOwn(dispositions, item.disposition),
        'Invalid historical inventory row'
      )
      assert.ok(!seen.has(item.word_id), 'Duplicate personal word in inventory')
      seen.add(item.word_id)
      const disposition = dispositions[item.disposition]
      counts[disposition] = (counts[disposition] ?? 0) + 1
      items.push({
        cohort: cohort.label,
        word_id: item.word_id,
        owner_id: item.user_id,
        historical_run_id: item.run_id,
        historical_source_sha256: item.source_sha256,
        historical_row_sha256: sha256(JSON.stringify(item)),
        disposition,
        eligible_to_link: false,
        reason:
          disposition === 'ambiguous'
            ? 'reviewed-meaning-and-full-content-diff-required'
            : 'retain-protected-legacy-content',
      })
    }
    summaries.push({ cohort: cohort.label, total: cohort.items.length, counts })
  }
  return {
    protocol_version: 2,
    scope: 'historical-snapshot-only',
    total: items.length,
    eligible_links: 0,
    cohorts: summaries,
    items,
  }
}

async function persistExactFile(path, bytes) {
  try {
    await writeFile(path, bytes, { flag: 'wx', mode: 0o600 })
  } catch (error) {
    if (error.code !== 'EEXIST') throw error
    assert.equal(
      await readFile(path, 'utf8'),
      bytes,
      'Inventory output intent changed'
    )
  }
}

/** Explicit local files only; no environment, credentials, database or network client. */
export async function prepareSavedInventory(configPath, outputDirectory) {
  const configBytes = await readFile(configPath)
  const config = JSON.parse(configBytes)
  assert.ok(
    record(config) && Array.isArray(config.cohorts),
    'Inventory config required'
  )
  const inputs = []
  const cohorts = []
  for (const cohort of config.cohorts) {
    assert.ok(
      record(cohort) &&
        typeof cohort.path === 'string' &&
        hash.test(cohort.sha256),
      'Exact historical file hash required'
    )
    const bytes = await readFile(cohort.path)
    assert.equal(sha256(bytes), cohort.sha256, 'Historical inventory changed')
    inputs.push({ path: cohort.path, sha256: cohort.sha256 })
    cohorts.push({
      label: cohort.label,
      expectedCount: cohort.expectedCount,
      items: JSON.parse(bytes),
    })
  }
  const inventory = classifySavedInventory(cohorts)
  await mkdir(outputDirectory, { recursive: true })
  const privateBytes = JSON.stringify(inventory, null, 2) + '\n'
  await persistExactFile(
    join(outputDirectory, 'private-inventory-v2.json'),
    privateBytes
  )
  const { items, ...summary } = inventory
  assert.equal(items.length, summary.total)
  const report = {
    ...summary,
    inputs,
    config_sha256: sha256(configBytes),
    protected_inventory_sha256: sha256(privateBytes),
    live_inventory_fresh: false,
    live_apply_authorized: false,
    approved_meaning_decisions: 0,
  }
  await persistExactFile(
    join(outputDirectory, 'inventory-summary.json'),
    JSON.stringify(report, null, 2) + '\n'
  )
  return report
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  assert.equal(
    process.argv.length,
    4,
    'Usage: node following-inventory.mjs config.json output-directory'
  )
  const result = await prepareSavedInventory(process.argv[2], process.argv[3])
  process.stdout.write(
    JSON.stringify({
      total: result.total,
      eligible_links: result.eligible_links,
      cohorts: result.cohorts,
    }) + '\n'
  )
}
