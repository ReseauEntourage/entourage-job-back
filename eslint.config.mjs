import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import typescriptSortKeys from 'eslint-plugin-typescript-sort-keys';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  { ignores: ['**/*.js', '**/*.mjs', 'dist/**'] },

  ...tsPlugin.configs['flat/recommended'],

  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,

  prettierRecommended,

  {
    files: ['**/*.ts'],
    plugins: {
      'typescript-sort-keys': typescriptSortKeys,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'tsconfig.json',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      'import/resolver': {
        typescript: {},
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        1,
        { ignoreRestSiblings: true, argsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-interface': 0,
      '@typescript-eslint/explicit-function-return-type': 0,

      'import/no-unresolved': 'off',
      'import/extensions': [
        2,
        'always',
        { ts: 'never', tsx: 'never', js: 'never' },
      ],
      'import/no-default-export': 2,
      'import/prefer-default-export': 0,
      'import/no-extraneous-dependencies': [
        'error',
        { devDependencies: ['tests/**/*', '**/*.spec.ts'] },
      ],
      'import/order': [
        1,
        {
          groups: [
            'builtin',
            'external',
            'internal',
            'parent',
            'sibling',
            'index',
          ],
          alphabetize: { order: 'asc' },
          pathGroups: [
            { pattern: 'src/**', group: 'parent' },
            { pattern: 'tests/**', group: 'parent' },
          ],
        },
      ],

      'typescript-sort-keys/interface': 'error',
      'typescript-sort-keys/string-enum': 'error',

      'no-console': [1, { allow: ['warn', 'error'] }],
      'no-multiple-empty-lines': [2, { max: 1 }],
      'object-curly-newline': 0,
      'no-useless-constructor': 0,
      'class-methods-use-this': 0,
      'max-classes-per-file': 0,
    },
  },
];
