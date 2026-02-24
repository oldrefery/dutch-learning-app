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
      branches: 8,
      functions: 10,
      lines: 15,
      statements: 15,
    },
    './src/utils': {
      branches: 65,
      functions: 50,
      lines: 65,
      statements: 65,
    },
    './src/services': {
      branches: 40,
      functions: 65,
      lines: 55,
      statements: 55,
    },
  },

  testMatch: [
    '**/__tests__/**/?(*.)+(spec|test).[jt]s?(x)',
    '**/?(*.)+(spec|test).[jt]s?(x)',
  ],

  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],

  modulePaths: ['<rootDir>/src'],
}
