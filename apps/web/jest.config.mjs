import path from 'node:path'
import { fileURLToPath } from 'node:url'

// noinspection JSUnresolvedReference -- Next.js documents this ESM subpath,
// but WebStorm cannot resolve the hoisted workspace dependency reliably.
import nextJest from 'next/jest.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(currentDirectory, '../..')
const createJestConfig = nextJest({ dir: currentDirectory })

const config = {
  clearMocks: true,
  collectCoverageFrom: [
    'apps/web/src/**/*.{ts,tsx}',
    '!apps/web/src/**/*.d.ts',
    '!apps/web/src/**/__tests__/**',
    '!apps/web/src/**/*.test.{ts,tsx}',
    '!apps/web/src/app/**',
    '!apps/web/src/**/*repository.ts',
    '!apps/web/src/**/actions.ts',
    '!apps/web/src/instrumentation*.ts',
    '!apps/web/src/proxy.ts',
    '!apps/web/src/sentry.*.config.ts',
    '!apps/web/src/lib/auth/session.ts',
    '!apps/web/src/lib/build-info.ts',
    '!apps/web/src/lib/supabase/{proxy,server}.ts',
  ],
  coverageDirectory: '<rootDir>/coverage/web',
  coverageProvider: 'v8',
  coverageReporters: ['text', 'lcov', 'json-summary'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 35,
      statements: 35,
    },
  },
  displayName: 'web',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@woordenaar/content$': '<rootDir>/packages/content/src/dutch-a1.json',
    '^@woordenaar/domain$': '<rootDir>/packages/domain/src/index.ts',
    '^@woordenaar/supabase-contracts$':
      '<rootDir>/packages/supabase-contracts/src/index.ts',
    '^react$': '<rootDir>/apps/web/node_modules/react',
    '^react/(.*)$': '<rootDir>/apps/web/node_modules/react/$1',
    '^react-dom$': '<rootDir>/apps/web/node_modules/react-dom',
    '^react-dom/(.*)$': '<rootDir>/apps/web/node_modules/react-dom/$1',
  },
  rootDir: repositoryRoot,
  setupFilesAfterEnv: ['<rootDir>/apps/web/jest.setup.ts'],
  testEnvironment: 'jsdom',
  testMatch: [
    '<rootDir>/apps/web/src/**/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
    '<rootDir>/apps/web/src/**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: ['<rootDir>/apps/web/e2e/'],
}

export default createJestConfig(config)
