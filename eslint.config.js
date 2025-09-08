const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  expoConfig,
  {
    ignores: [
      'dist/*',
      '.expo/*',
      'ios/*',
      'android/*',
      'supabase/functions/*',
    ],
  },
  {
    // Cognitive Complexity Rules - Using recommended preset
    ...require('eslint-plugin-sonarjs').configs.recommended,
    rules: {
      // Override default cognitive complexity threshold
      'sonarjs/cognitive-complexity': ['warn', 15],

      // Code quality rules with custom settings
      'sonarjs/max-switch-cases': ['error', 10],
      'sonarjs/no-duplicate-string': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-duplicated-branches': 'warn',
      'sonarjs/no-redundant-boolean': 'warn',
      'sonarjs/prefer-immediate-return': 'warn',
      'sonarjs/prefer-single-boolean-return': 'warn',
    },
  },
])
