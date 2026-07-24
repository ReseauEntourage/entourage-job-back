import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import-x';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import perfectionist from 'eslint-plugin-perfectionist';
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
      perfectionist,
    },
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: 'tsconfig.eslint.json',
        sourceType: 'module',
      },
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
    settings: {
      'import-x/resolver': {
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

      'import-x/no-unresolved': 'off',
      'import-x/namespace': 'off',
      'import-x/no-named-as-default': 'off',
      'import-x/no-named-as-default-member': 'off',
      'import-x/extensions': [
        2,
        'always',
        { ts: 'never', tsx: 'never', js: 'never' },
      ],
      'import-x/no-default-export': 2,
      'import-x/prefer-default-export': 0,
      'import-x/no-extraneous-dependencies': [
        'error',
        { devDependencies: ['tests/**/*', '**/*.spec.ts'] },
      ],
      'import-x/order': [
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

      'perfectionist/sort-interfaces': 'error',
      'perfectionist/sort-enums': 'error',

      'no-console': [1, { allow: ['warn', 'error'] }],
      'no-multiple-empty-lines': [2, { max: 1 }],
      'object-curly-newline': 0,
      'no-useless-constructor': 0,
      'class-methods-use-this': 0,
      'max-classes-per-file': 0,
    },
  },
];
