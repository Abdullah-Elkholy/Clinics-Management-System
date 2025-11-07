// Flat ESLint config to override any inherited Next.js patch behavior
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');
const reactPlugin = require('eslint-plugin-react');
const reactHooksPlugin = require('eslint-plugin-react-hooks');

// Helper to merge rule objects from recommended configs
function mergeRules() {
  return Object.assign(
    {},
    tsPlugin.configs.recommended.rules,
    reactPlugin.configs.recommended.rules,
    reactHooksPlugin.configs.recommended.rules
  );
}

module.exports = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: [
      'node_modules/',
      '.next/',
      'dist/',
      'coverage/',
      'docs/',
    ],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...mergeRules(),
      // Custom project rules
      'no-console': 'error',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }
      ],
      'react/react-in-jsx-scope': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
        // Relax initial strictness to allow staged cleanup
        '@typescript-eslint/no-explicit-any': ['warn', { ignoreRestArgs: true }],
        '@typescript-eslint/no-non-null-asserted-optional-chain': 'warn',
        'react/no-unescaped-entities': 'warn',
        // Permit styled-jsx <style jsx> usage
        'react/no-unknown-property': ['error', { ignore: ['jsx'] }],
    },
  },
];
