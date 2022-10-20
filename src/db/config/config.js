const path = require('path');
const dotenv = require('dotenv');

const envPath =
  process.env.NODE_ENV === 'dev-test' ? '../../../.env.test' : '../../../.env';
const completePath = path.resolve(__dirname, envPath);

dotenv.config({ path: completePath });

module.exports = {
  development: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
  },
  test: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
  },
  'dev-test': {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
  },
  production: {
    use_env_variable: 'DATABASE_URL',
    dialect: 'postgres',
    dialectOptions: {
      ssl: {
        require: true,
        rejectUnauthorized: false,
      },
    },
  },
};
