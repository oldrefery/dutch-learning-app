module.exports = [
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    ignores: [
      'node_modules/',
      'dist/',
      'build/',
      '.expo/',
      'supabase/functions/',
    ],
    rules: {
      'no-unused-vars': 'warn',
      'no-console': 'warn',
    },
  },
]
