/* ESLint configuration for clinics-management-web */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react-hooks/recommended',
    'next/core-web-vitals',
  ],
  rules: {
    // Disallow all console usage (build artifacts ignored via .eslintignore)
    'no-console': 'error',
    // Allow unused vars only if they start with _ (often for ignored params)
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'react/react-in-jsx-scope': 'off', // Next.js provides React globally
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    // Additional rules for code quality
    'no-case-declarations': 'warn',
    'no-undef': 'warn',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    '@typescript-eslint/no-var-requires': 'warn',
    '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
    '@typescript-eslint/no-explicit-any': 'warn',
    'react/no-unescaped-entities': 'warn',
    'react/no-unknown-property': ['error', { ignore: ['jsx'] }],
    'react-hooks/exhaustive-deps': 'warn',
    '@typescript-eslint/ban-types': 'warn',
    '@typescript-eslint/ban-ts-comment': 'warn',
    '@typescript-eslint/triple-slash-reference': 'warn',
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'dist/',
    'coverage/',
    'docs/',
    '*.d.ts',
  ],
};
