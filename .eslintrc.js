module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    sourceType: 'module',
  },
  plugins: [
    '@typescript-eslint/eslint-plugin',
    '@typescript-eslint',
    'typescript-sort-keys',
    'import',
  ],
  extends: [
    'plugin:import/recommended',
    'plugin:@typescript-eslint/eslint-recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  root: true,
  env: {
    node: true,
    jest: true,
    es6: true,
  },
  ignorePatterns: ['.eslintrc.js'],
  rules: {
    // TypeScript Rules
    '@typescript-eslint/no-unused-vars': [1, { ignoreRestSiblings: true }],
    '@typescript-eslint/member-delimiter-style': [
      1,
      {
        multiline: {
          delimiter: 'semi',
          requireLast: true,
        },
        singleline: {
          delimiter: 'semi',
          requireLast: false,
        },
      },
    ],
    '@typescript-eslint/no-empty-interface': 0,
    // many times, typing will bring duplication
    '@typescript-eslint/explicit-function-return-type': 0,
    '@typescript-eslint/ban-ts-ignore': 0,
    '@typescript-eslint/interface-name-prefix': 0,

    // Import Rules
    'import/extensions': [
      2,
      'always',
      { ts: 'never', tsx: 'never', js: 'never' },
    ],
    'import/no-default-export': 2,
    'import/prefer-default-export': 0,
    // allow to use devDeps in test files.
    // See options: https://github.com/benmosher/eslint-plugin-import/blob/master/docs/rules/no-extraneous-dependencies.md#options
    'import/no-extraneous-dependencies': [
      'error',
      { devDependencies: ['tests/**/*', '**/*.spec.ts'] },
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          'src/*/*',
          '!src/auth/*',
          'src/auth/*/*',
          '!src/mails/*',
          'src/mails/*/*',
          '!src/queues/*',
          'src/queues/*/*',
          '!src/users/*',
          'src/users/*/*',
          '!src/utils/*',
          'src/utils/*/*',

          'tests/*/*',
          '!tests/users/*',
          'tests/users/*/*',
          '!tests/auth/*',
          'tests/auth/*/*',
        ],
      },
    ],
    // 'sort-imports': 2,
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
        alphabetize: {
          order: 'asc',
        },
        pathGroups: [
          {
            pattern: 'src/**',
            group: 'parent',
          },
          {
            pattern: 'tests/**',
            group: 'parent',
          },
        ],
      },
    ],

    // Plain JavaScript Rules
    'arrow-body-style': 0,
    'no-console': [1, { allow: ['warn', 'error'] }],
    'no-multiple-empty-lines': [2, { max: 1 }], // prettier like
    // max-len is enought
    'object-curly-newline': 0,
    // disable due to TypeScript params. More infos here: https://kendaleiv.com/typescript-constructor-assignment-public-and-private-keywords
    'no-useless-constructor': 0,
    'class-methods-use-this': 0,
    'max-classes-per-file': 0,
  },
  settings: {
    'import/resolver': {
      // use <root>/tsconfig.json
      typescript: {},
    },
  },
};
