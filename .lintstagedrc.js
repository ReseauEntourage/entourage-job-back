module.exports = {
  '*.ts?(x)': [() => 'pnpm run test:ts-check', 'pnpm run test:eslint'],
};
