import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

// Read only: redirecting output is unnecessary; persist the result via a patch.
const [platform, words, connectivity, logPath] = process.argv.slice(2)
assert.ok(['ios', 'android'].includes(platform))
assert.ok(['500', '2500'].includes(words))
assert.ok(['online', 'backend-offline'].includes(connectivity))
const samples = readFileSync(logPath, 'utf8')
  .split('\n')
  .filter(line => line.includes('JsConsole: D01_NATIVE_SAMPLE '))
  .map(line => JSON.parse(line.split('D01_NATIVE_SAMPLE ')[1]))
assert.equal(samples.length, 5)
samples.forEach((sample, index) => {
  assert.equal(sample.sample, index + 1)
  assert.ok(Number.isFinite(sample.elapsedMs) && sample.elapsedMs > 0)
})
const sorted = samples.map(sample => sample.elapsedMs).sort((a, b) => a - b)
console.log(
  JSON.stringify(
    {
      platform,
      words: Number(words),
      connectivity,
      metric:
        'Launch command to populated collections, including automation overhead',
      samplesMs: samples.map(sample => sample.elapsedMs),
      medianMs: sorted[2],
      minMs: sorted[0],
      maxMs: sorted[4],
      sourceLog: logPath,
    },
    null,
    2
  )
)
