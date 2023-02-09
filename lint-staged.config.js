module.exports = {
  'src/**/*.ts?(x) tests/**/*.ts?(x)': [() => 'yarn test:ts-check', 'yarn test:eslint'],
};
