import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  rm,
  symlink,
} from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(
  new URL('../../reports/vocabulary-organization/', import.meta.url)
)
const cli = fileURLToPath(new URL('./analyze.mjs', import.meta.url))
const owner = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const protectedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const wordId = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc'

async function fixture(context) {
  await mkdir(root, { recursive: true })
  const directory = await mkdtemp(join(root, 'synthetic-cli-test-'))
  context.after(() => rm(directory, { recursive: true, force: true }))
  const snapshot = join(directory, 'snapshot.json')
  const source = join(directory, 'source.tsv')
  const output = join(directory, 'result.json')
  await writeFile(
    snapshot,
    JSON.stringify({
      schemaVersion: 1,
      matchedAccounts: 1,
      ownerId: owner,
      capturedAt: '2026-09-07T10:00:00Z',
      collections: [{ collection_id: protectedId, is_shared: false }],
      cards: [
        {
          word_id: wordId,
          collection_id: null,
          dutch_lemma: 'huis',
          part_of_speech: 'noun',
          is_expression: false,
          expression_type: null,
          translations: { en: ['house'] },
          updated_at: '2026-09-07T10:00:00Z',
        },
      ],
    })
  )
  await writeFile(
    source,
    'word\ttag\tF@TOTAL\tF@A1\tF@A2\tF@B1\tF@B2\tF@C1\nhuis\tN(soort)\t1\t1\t-\t-\t-\t-\n'
  )
  const run = (overrides = {}) => {
    const args = {
      snapshot,
      source,
      output,
      owner,
      protected: protectedId,
      'expected-cards': '1',
      ...overrides,
    }
    return spawnSync(
      process.execPath,
      [
        cli,
        ...Object.entries(args).flatMap(([key, value]) => [`--${key}`, value]),
      ],
      {
        encoding: 'utf8',
        timeout: 10000,
      }
    )
  }
  return { run, snapshot, output, directory }
}

test('CLI keeps input unchanged and refuses to overwrite an earlier report', async context => {
  const data = await fixture(context)
  const before = await readFile(data.snapshot, 'utf8')
  const first = data.run()
  assert.equal(first.status, 0, first.stderr)
  assert.equal(JSON.parse(first.stdout).productionWrites, 0)
  assert.equal(await readFile(data.snapshot, 'utf8'), before)
  const report = await readFile(data.output, 'utf8')
  assert.equal(data.run().status, 1)
  assert.equal(await readFile(data.output, 'utf8'), report)
})

test('CLI rejects wrong owner/count before creating output', async context => {
  const data = await fixture(context)
  assert.equal(data.run({ owner: wordId }).status, 1)
  assert.equal(data.run({ 'expected-cards': '2' }).status, 1)
  await assert.rejects(readFile(data.output), { code: 'ENOENT' })
})

test('CLI refuses output outside the private directory and unknown options', async context => {
  const data = await fixture(context)
  assert.match(
    data.run({ output: '/tmp/vocabulary-must-not-be-written.json' }).stderr,
    /Keep private/u
  )
  assert.equal(data.run({ apply: 'true' }).status, 1)
})

test('CLI refuses a symlink that escapes the private directory', async context => {
  const data = await fixture(context)
  const alias = join(data.directory, 'outside')
  await symlink('/tmp', alias)
  assert.match(
    data.run({ output: join(alias, 'must-not-be-written.json') }).stderr,
    /must not resolve/u
  )
})
