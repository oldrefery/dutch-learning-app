import path from 'node:path'
import { fileURLToPath } from 'node:url'

import baseConfig from '../../jest.config.js'

const currentDirectory = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(currentDirectory, '../..')

const config = {
  ...baseConfig,
  displayName: 'web',
  rootDir: repositoryRoot,
  moduleNameMapper: {
    ...baseConfig.moduleNameMapper,
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
  },
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
  coverageThreshold: {
    global: {
      branches: 20,
      functions: 25,
      lines: 25,
      statements: 25,
    },
  },
  testMatch: [
    '<rootDir>/apps/web/src/**/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
    '<rootDir>/apps/web/src/**/?(*.)+(spec|test).[jt]s?(x)',
  ],
  testPathIgnorePatterns: ['<rootDir>/apps/web/e2e/'],
}

export default config
