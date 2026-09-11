import { readFile, realpath, writeFile } from 'node:fs/promises'
import { parseArgs } from 'node:util'
import { resolve, relative, sep, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseSnapshot, sha256, validateSnapshot } from './snapshot.mjs'
import { parseLexicon } from './lexicon.mjs'
import { buildReport } from './report.mjs'

const repository = fileURLToPath(new URL('../../', import.meta.url))
const privateRoot = resolve(repository, 'reports/vocabulary-organization')

async function privatePath(input, isOutput = false) {
  const path = resolve(input)
  const fromRoot = relative(privateRoot, path)
  if (!fromRoot || fromRoot === '..' || fromRoot.startsWith(`..${sep}`)) {
    throw new Error(
      'Keep private input/output inside reports/vocabulary-organization'
    )
  }
  const actualRoot = await realpath(privateRoot)
  const actualPath = await realpath(isOutput ? dirname(path) : path)
  if (
    actualRoot !== privateRoot ||
    (actualPath !== privateRoot &&
      !actualPath.startsWith(`${privateRoot}${sep}`))
  ) {
    throw new Error(
      'Private paths must not resolve outside the ignored analysis directory'
    )
  }
  return path
}

async function main() {
  const { values } = parseArgs({
    options: {
      snapshot: { type: 'string' },
      source: { type: 'string' },
      output: { type: 'string' },
      owner: { type: 'string' },
      protected: { type: 'string' },
      'expected-cards': { type: 'string' },
    },
  })
  if (Object.keys(values).length !== 6) {
    throw new Error(
      'Required: --snapshot --source --output --owner --protected --expected-cards'
    )
  }
  const output = await privatePath(values.output, true)
  const snapshotText = await readFile(
    await privatePath(values.snapshot),
    'utf8'
  )
  const sourceText = await readFile(resolve(values.source), 'utf8')
  const snapshot = parseSnapshot(snapshotText)
  const options = {
    ownerId: values.owner,
    protectedId: values.protected,
    expectedCards: Number(values['expected-cards']),
    snapshotSha256: sha256(snapshotText),
    sourceSha256: sha256(sourceText),
  }
  validateSnapshot(snapshot, options)
  const report = buildReport(snapshot, parseLexicon(sourceText), options)
  // Never overwrite an earlier analysis. No network or database write capability.
  await writeFile(output, `${JSON.stringify(report, null, 2)}\n`, {
    flag: 'wx',
    mode: 0o600,
  })
  console.log(JSON.stringify(report.summary, null, 2))
}

try {
  await main()
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Analysis failed')
  process.exitCode = 1
}
