/** @jest-environment node */
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { prepareReviewQuestions } from './session-questions'
import { createPerformanceWorkspace } from './performance-fixtures'

const runHarness = process.env.PERFORMANCE_HARNESS === '1'
const performanceTest = runHarness ? test : test.skip
const fixtureSizes = [2500, 5000] as const

performanceTest(
  'writes five-run preparation metrics for deterministic review fixtures',
  async () => {
    const measurements = fixtureSizes.flatMap(wordCount => {
      const workspace = createPerformanceWorkspace(wordCount)
      return Array.from({ length: 5 }, (_, run) => {
        const startedAt = performance.now()
        const questions = prepareReviewQuestions(
          workspace.words,
          workspace.words,
          workspace.events,
          'adaptive'
        )
        const durationMs = performance.now() - startedAt
        expect(questions).toHaveLength(wordCount)
        return {
          bytes: Buffer.byteLength(JSON.stringify(workspace)),
          durationMs: Number(durationMs.toFixed(3)),
          fixture: `adaptive-${wordCount}`,
          longTask: durationMs >= 50,
          run: run + 1,
        }
      })
    })
    const outputDirectory = path.resolve(
      process.cwd(),
      process.env.WEB_PERFORMANCE_OUTPUT ?? 'output/performance'
    )
    const generatedAt = new Date().toISOString()
    const report = {
      fixtureRevision: 'review-preparation-v1',
      generatedAt,
      measurements,
      runtime: { node: process.version, platform: process.platform },
    }
    const markdown = [
      '# Web review preparation benchmark',
      '',
      `Generated: ${generatedAt}`,
      '',
      '| Fixture | Run | Duration (ms) | Bytes | Long task |',
      '| --- | ---: | ---: | ---: | --- |',
      ...measurements.map(
        value =>
          `| ${value.fixture} | ${value.run} | ${value.durationMs} | ${value.bytes} | ${value.longTask ? 'yes' : 'no'} |`
      ),
      '',
    ].join('\n')

    await mkdir(outputDirectory, { recursive: true })
    await Promise.all([
      writeFile(
        path.join(outputDirectory, 'preparation-metrics.json'),
        `${JSON.stringify(report, null, 2)}\n`
      ),
      writeFile(path.join(outputDirectory, 'preparation-metrics.md'), markdown),
    ])
  }
)
