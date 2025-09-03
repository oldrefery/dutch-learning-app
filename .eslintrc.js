// @ts-check
import { FlatCompat } from '@eslint/eslintrc'

const compat = new FlatCompat({
    baseDirectory: import.meta.dirname,
})

export default [
    ...compat.extends('expo', '@typescript-eslint/recommended'),
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
            '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
            '@typescript-eslint/explicit-function-return-type': 'off',
            '@typescript-eslint/explicit-module-boundary-types': 'off',
            '@typescript-eslint/no-explicit-any': 'warn',
            'react-hooks/exhaustive-deps': 'warn',
        },
    },
]
