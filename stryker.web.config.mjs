/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  checkers: ['typescript'],
  concurrency: 2,
  coverageAnalysis: 'perTest',
  disableTypeChecks: false,
  incremental: true,
  incrementalFile: 'reports/stryker-web-incremental.json',
  ignorePatterns: [
    'android',
    'ios',
    'design',
    'dist',
    'builds',
    'coverage',
    'apps/web/.next',
    'apps/web/playwright-report',
    'apps/web/test-results',
  ],
  jest: {
    configFile: 'apps/web/jest.config.mjs',
    enableFindRelatedTests: true,
    projectType: 'custom',
  },
  mutate: [
    'apps/web/src/features/analysis/analysis-preview.ts',
    'apps/web/src/features/analysis/semantic-duplicate.ts',
    'apps/web/src/features/collections/collection-validation.ts',
    'apps/web/src/features/search/word-search.ts',
    'apps/web/src/features/settings/account-deletion.ts',
    'apps/web/src/features/words/word-image.ts',
    'apps/web/src/features/words/word-mutations.ts',
  ],
  reporters: ['clear-text', 'progress', 'html'],
  testRunner: 'jest',
  thresholds: {
    break: 90,
    high: 90,
    low: 75,
  },
  timeoutMS: 15_000,
  tsconfigFile: 'apps/web/tsconfig.json',
  typescriptChecker: {
    prioritizePerformanceOverAccuracy: true,
  },
}

export default config
