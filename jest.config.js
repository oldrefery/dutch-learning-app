module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',

  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],

  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-url-polyfill|@supabase/sentry-js-integration)',
  ],

  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.types.ts',
    '!src/**/*.styles.ts',
    '!src/**/__tests__/**',
    '!src/app/**',
  ],

  coverageThreshold: {
    global: {
      branches: 2,
      functions: 3,
      lines: 7,
      statements: 7,
    },
    './src/utils': {
      branches: 90,
      functions: 95,
      lines: 95,
      statements: 95,
    },
    './src/services': {
      branches: 60,
      functions: 80,
      lines: 73,
      statements: 73,
    },
    './src/stores': {
      branches: 50,
      functions: 50,
      lines: 80,
      statements: 80,
    },
    './src/db': {
      branches: 50,
      functions: 55,
      lines: 50,
      statements: 50,
    },
    './src/hooks': {
      branches: 35,
      functions: 45,
      lines: 40,
      statements: 40,
    },
  },

  testMatch: [
    '**/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  modulePaths: ['<rootDir>/src'],
}
